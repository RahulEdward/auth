export default function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Sign Up & Configure',
      description: 'Create your account and configure OAuth providers, MFA settings, and subscription plans through our admin dashboard.',
      code: `npm install @enterprise-auth/sdk`,
    },
    {
      number: '2',
      title: 'Integrate with Your App',
      description: 'Use our SDKs to integrate authentication into your application. Available for JavaScript, Python, Java, Go, and Ruby.',
      code: `import { AuthClient } from '@enterprise-auth/sdk';

const auth = new AuthClient({
  apiKey: 'your-api-key'
});`,
    },
    {
      number: '3',
      title: 'Start Authenticating',
      description: 'Your users can now sign up, log in with OAuth, enable MFA, and manage their sessions. You get full control through the admin dashboard.',
      code: `// Register a new user
await auth.register({
  email: 'user@example.com',
  password: 'secure-password'
});`,
    },
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get started in minutes with our simple integration process
          </p>
        </div>
        <div className="space-y-16">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'
              } gap-8 items-center`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                    {step.number}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {step.title}
                  </h3>
                </div>
                <p className="text-lg text-gray-600 mb-4">{step.description}</p>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gray-900 rounded-lg p-6 overflow-x-auto">
                  <pre className="text-green-400 text-sm">
                    <code>{step.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
