'use client';

import { useState } from 'react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: 'How secure is the authentication system?',
      answer: 'We implement industry-standard security practices including Argon2id password hashing, JWT tokens with RS256 signing, rate limiting, CSRF protection, and comprehensive audit logging. All data is encrypted in transit and at rest.',
    },
    {
      question: 'Can I customize the authentication flow?',
      answer: 'Yes! Our system is highly customizable. You can configure OAuth providers, MFA methods, password policies, session timeouts, and more through the admin dashboard or API.',
    },
    {
      question: 'What OAuth providers are supported?',
      answer: 'We currently support Google, Facebook, and GitHub OAuth. Additional providers can be added upon request for Enterprise customers.',
    },
    {
      question: 'How does pricing work?',
      answer: 'Pricing is based on the number of active users in your system. You can start with our free tier (up to 100 users) and upgrade as you grow. All paid plans include a 14-day free trial.',
    },
    {
      question: 'Is there a setup fee?',
      answer: 'No setup fees! You can start using the system immediately after signing up. Our SDKs and documentation make integration straightforward.',
    },
    {
      question: 'What kind of support do you offer?',
      answer: 'Free tier includes community support. Paid plans include email support with response times based on your plan. Enterprise customers get dedicated support with SLA guarantees.',
    },
    {
      question: 'Can I export my user data?',
      answer: 'Yes, we provide full data export capabilities. You own your data and can export it at any time in standard formats (JSON, CSV).',
    },
    {
      question: 'Is the system GDPR compliant?',
      answer: 'Yes, we are fully GDPR compliant. We provide tools for user consent management, data export, and account deletion as required by GDPR.',
    },
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Got questions? We've got answers.
          </p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 pr-8">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 transform transition-transform flex-shrink-0 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-gray-600">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@enterpriseauth.com"
            className="text-blue-600 hover:text-blue-700 font-semibold"
          >
            Contact our support team →
          </a>
        </div>
      </div>
    </section>
  );
}
