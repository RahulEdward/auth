import { mfaService } from '../services/mfa.service';
import { db, redis } from '@auth/shared';
import speakeasy from 'speakeasy';

describe('MFA Integration Tests', () => {
    let testUserId: string;
    let testUserEmail: string;

    beforeAll(async () => {
        // Create a test user
        const userResult = await db.query(
            `INSERT INTO users (email, name, password_hash, email_verified, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            ['mfatest@example.com', 'MFA Test User', 'hashed-password', true, 'active']
        );
        testUserId = userResult.rows[0].id;
        testUserEmail = 'mfatest@example.com';
    });

    afterAll(async () => {
        // Clean up test user
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await db.disconnect();
        await redis.disconnect();
    });

    afterEach(async () => {
        // Clean up Redis keys - delete them individually since we can't use keys() pattern
        // In a real test environment, you might want to use a separate Redis database
        await redis.del(`mfa_enrollment:${testUserId}`);
        await redis.del(`mfa_sms_code:${testUserId}`);
        await redis.del(`mfa_email_code:${testUserId}`);
        await redis.del(`mfa_sms_attempts:${testUserId}`);
        await redis.del(`mfa_email_attempts:${testUserId}`);
        await redis.del(`mfa_used_codes:${testUserId}`);
    });

    describe('TOTP MFA Enrollment', () => {
        it('should enroll user in TOTP MFA', async () => {
            const result = await mfaService.enrollTOTP(testUserId, testUserEmail);

            expect(result.secret).toBeDefined();
            expect(result.qrCodeUrl).toBeDefined();
            expect(result.qrCodeUrl).toContain('data:image/png;base64');
            expect(result.backupCodes).toHaveLength(10);
            expect(result.backupCodes[0]).toHaveLength(8);

            // Verify enrollment data stored in Redis
            const enrollmentData = await redis.get(`mfa_enrollment:${testUserId}`);
            expect(enrollmentData).toBeDefined();
        });

        it('should throw error if MFA already enabled', async () => {
            // Enable MFA for user
            await db.query(
                'UPDATE users SET mfa_enabled = $1 WHERE id = $2',
                [true, testUserId]
            );

            await expect(mfaService.enrollTOTP(testUserId, testUserEmail)).rejects.toThrow(
                'MFA is already enabled for this user'
            );

            // Reset
            await db.query(
                'UPDATE users SET mfa_enabled = $1 WHERE id = $2',
                [false, testUserId]
            );
        });

        it('should verify TOTP enrollment and activate MFA', async () => {
            // Enroll
            const enrollment = await mfaService.enrollTOTP(testUserId, testUserEmail);

            // Generate valid TOTP code
            const code = speakeasy.totp({
                secret: enrollment.secret,
                encoding: 'base32',
            });

            // Verify enrollment
            const result = await mfaService.verifyTOTPEnrollment(testUserId, code);

            expect(result.success).toBe(true);

            // Verify MFA is enabled in database
            const userResult = await db.query(
                'SELECT mfa_enabled, mfa_method, mfa_secret, backup_codes FROM users WHERE id = $1',
                [testUserId]
            );

            expect(userResult.rows[0].mfa_enabled).toBe(true);
            expect(userResult.rows[0].mfa_method).toBe('totp');
            expect(userResult.rows[0].mfa_secret).toBeDefined();
            expect(userResult.rows[0].backup_codes).toHaveLength(10);

            // Verify enrollment data removed from Redis
            const enrollmentData = await redis.get(`mfa_enrollment:${testUserId}`);
            expect(enrollmentData).toBeNull();
        });

        it('should reject invalid TOTP code during enrollment', async () => {
            // Enroll
            await mfaService.enrollTOTP(testUserId, testUserEmail);

            // Try with invalid code
            await expect(mfaService.verifyTOTPEnrollment(testUserId, '000000')).rejects.toThrow(
                'Invalid verification code'
            );
        });
    });

    describe('TOTP MFA Verification', () => {
        let secret: string;

        beforeEach(async () => {
            // Enroll and activate MFA
            const enrollment = await mfaService.enrollTOTP(testUserId, testUserEmail);
            secret = enrollment.secret;

            const code = speakeasy.totp({
                secret,
                encoding: 'base32',
            });

            await mfaService.verifyTOTPEnrollment(testUserId, code);
        });

        it('should verify valid TOTP code', async () => {
            // Generate valid code
            const code = speakeasy.totp({
                secret,
                encoding: 'base32',
            });

            const result = await mfaService.verifyTOTP(testUserId, code);

            expect(result.success).toBe(true);
        });

        it('should reject invalid TOTP code', async () => {
            const result = await mfaService.verifyTOTP(testUserId, '000000');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid verification code');
        });

        it('should prevent TOTP code reuse', async () => {
            // Generate valid code
            const code = speakeasy.totp({
                secret,
                encoding: 'base32',
            });

            // First use - should succeed
            const result1 = await mfaService.verifyTOTP(testUserId, code);
            expect(result1.success).toBe(true);

            // Second use - should fail
            const result2 = await mfaService.verifyTOTP(testUserId, code);
            expect(result2.success).toBe(false);
            expect(result2.message).toBe('This code has already been used');
        });
    });

    describe('SMS MFA', () => {
        beforeEach(async () => {
            // Add phone number to user
            await db.query(
                'UPDATE users SET phone_number = $1 WHERE id = $2',
                ['+1234567890', testUserId]
            );
        });

        it('should send SMS code', async () => {
            await expect(
                mfaService.sendSMSCode(testUserId, '+1234567890')
            ).resolves.not.toThrow();

            // Verify code stored in Redis
            const codeHash = await redis.get(`mfa_sms_code:${testUserId}`);
            expect(codeHash).toBeDefined();
        });

        it('should enforce rate limiting on SMS codes', async () => {
            // Send 3 codes (should succeed)
            await mfaService.sendSMSCode(testUserId, '+1234567890');
            await mfaService.sendSMSCode(testUserId, '+1234567890');
            await mfaService.sendSMSCode(testUserId, '+1234567890');

            // 4th attempt should fail
            await expect(
                mfaService.sendSMSCode(testUserId, '+1234567890')
            ).rejects.toThrow('Too many MFA code requests');
        });

        it('should verify valid SMS code', async () => {
            // We need to mock the code since we can't actually receive SMS
            const { hashToken } = await import('@auth/shared');
            const code = '123456';
            const codeHash = hashToken(code);

            await redis.set(`mfa_sms_code:${testUserId}`, codeHash, 5 * 60);

            const result = await mfaService.verifySMSOrEmailCode(testUserId, code, 'sms');

            expect(result.success).toBe(true);

            // Verify code removed from Redis
            const storedCode = await redis.get(`mfa_sms_code:${testUserId}`);
            expect(storedCode).toBeNull();
        });

        it('should reject invalid SMS code', async () => {
            const { hashToken } = await import('@auth/shared');
            const codeHash = hashToken('123456');

            await redis.set(`mfa_sms_code:${testUserId}`, codeHash, 5 * 60);

            const result = await mfaService.verifySMSOrEmailCode(testUserId, '999999', 'sms');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid verification code');
        });
    });

    describe('Email MFA', () => {
        it('should send email code', async () => {
            await expect(
                mfaService.sendEmailCode(testUserId, testUserEmail)
            ).resolves.not.toThrow();

            // Verify code stored in Redis
            const codeHash = await redis.get(`mfa_email_code:${testUserId}`);
            expect(codeHash).toBeDefined();
        });

        it('should enforce rate limiting on email codes', async () => {
            // Send 3 codes (should succeed)
            await mfaService.sendEmailCode(testUserId, testUserEmail);
            await mfaService.sendEmailCode(testUserId, testUserEmail);
            await mfaService.sendEmailCode(testUserId, testUserEmail);

            // 4th attempt should fail
            await expect(
                mfaService.sendEmailCode(testUserId, testUserEmail)
            ).rejects.toThrow('Too many MFA code requests');
        });

        it('should verify valid email code', async () => {
            const { hashToken } = await import('@auth/shared');
            const code = '654321';
            const codeHash = hashToken(code);

            await redis.set(`mfa_email_code:${testUserId}`, codeHash, 5 * 60);

            const result = await mfaService.verifySMSOrEmailCode(testUserId, code, 'email');

            expect(result.success).toBe(true);
        });
    });

    describe('Backup Codes', () => {
        let backupCodes: string[];

        beforeEach(async () => {
            // Enroll and activate MFA
            const enrollment = await mfaService.enrollTOTP(testUserId, testUserEmail);
            backupCodes = enrollment.backupCodes;

            const code = speakeasy.totp({
                secret: enrollment.secret,
                encoding: 'base32',
            });

            await mfaService.verifyTOTPEnrollment(testUserId, code);
        });

        it('should verify valid backup code', async () => {
            const backupCode = backupCodes[0];

            const result = await mfaService.verifyBackupCode(testUserId, backupCode);

            expect(result.success).toBe(true);

            // Verify backup code removed from database
            const userResult = await db.query(
                'SELECT backup_codes FROM users WHERE id = $1',
                [testUserId]
            );

            expect(userResult.rows[0].backup_codes).toHaveLength(9);
        });

        it('should reject invalid backup code', async () => {
            const result = await mfaService.verifyBackupCode(testUserId, 'INVALID123');

            expect(result.success).toBe(false);
            expect(result.message).toBe('Invalid backup code');
        });

        it('should warn when running low on backup codes', async () => {
            // Use 7 backup codes (leaving 3)
            for (let i = 0; i < 7; i++) {
                await mfaService.verifyBackupCode(testUserId, backupCodes[i]);
            }

            // Use 8th code - should warn
            const result = await mfaService.verifyBackupCode(testUserId, backupCodes[7]);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Only 2 backup codes remaining');
        });

        it('should prevent reuse of backup code', async () => {
            const backupCode = backupCodes[0];

            // First use
            const result1 = await mfaService.verifyBackupCode(testUserId, backupCode);
            expect(result1.success).toBe(true);

            // Second use - should fail
            const result2 = await mfaService.verifyBackupCode(testUserId, backupCode);
            expect(result2.success).toBe(false);
            expect(result2.message).toBe('Invalid backup code');
        });
    });

    describe('MFA Disable', () => {
        beforeEach(async () => {
            // Enroll and activate MFA
            const enrollment = await mfaService.enrollTOTP(testUserId, testUserEmail);

            const code = speakeasy.totp({
                secret: enrollment.secret,
                encoding: 'base32',
            });

            await mfaService.verifyTOTPEnrollment(testUserId, code);

            // Set password hash for user
            const { hashPassword } = await import('@auth/shared');
            const passwordHash = await hashPassword('TestPassword123!');
            await db.query(
                'UPDATE users SET password_hash = $1 WHERE id = $2',
                [passwordHash, testUserId]
            );
        });

        it('should disable MFA with valid password', async () => {
            await expect(
                mfaService.disableMFA(testUserId, 'TestPassword123!')
            ).resolves.not.toThrow();

            // Verify MFA disabled in database
            const userResult = await db.query(
                'SELECT mfa_enabled, mfa_method, mfa_secret, backup_codes FROM users WHERE id = $1',
                [testUserId]
            );

            expect(userResult.rows[0].mfa_enabled).toBe(false);
            expect(userResult.rows[0].mfa_method).toBeNull();
            expect(userResult.rows[0].mfa_secret).toBeNull();
            expect(userResult.rows[0].backup_codes).toBeNull();
        });

        it('should reject invalid password when disabling MFA', async () => {
            await expect(
                mfaService.disableMFA(testUserId, 'WrongPassword')
            ).rejects.toThrow('Invalid password');
        });
    });
});
