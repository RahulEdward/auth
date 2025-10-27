export default function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for side projects and testing',
      features: [
        'Up to 100 users',
        'Basic authentication',
        'Email verification',
        'Community support',
        'API access',
      ],
      cta: 'Start Free',
      highlighted: false,
      gradient: 'from-gray-400 to-gray-600',
    },
    {
      name: 'Starter',
      price: '$29',
      period: 'per month',
      description: 'For growing startups and small teams',
      features: [
        'Up to 1,000 users',
        'OAuth social login',
        'Multi-factor authentication',
        'Email support',
        'API access',
        'Basic analytics',
      ],
      cta: 'Start Trial',
      highlighted: false,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Professional',
      price: '$99',
      period: 'per month',
      description: 'For established businesses',
      features: [
        'Up to 10,000 users',
        'Everything in Starter',
        'RBAC & permissions',
        'Session management',
        'Priority support',
        'Advanced analytics',
        'Custom branding',
      ],
      cta: 'Start Trial',
      highlighted: true,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
      description: 'For large organizations',
      features: [
        'Unlimited users',
        'Everything in Professional',
        'Dedicated support',
        'SLA guarantee',
        'Custom integrations',
        'On-premise deployment',
        'Compliance assistance',
      ],
      cta: 'Contact Sales',
      highlighted: false,
      gradient: 'from-indigo-500 to-purple-500',
    },
  ];

  return (
    <section id="pricing" className="py-24 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            Simple, Transparent
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Pricing</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose the plan that fits your needs. All plans include 14-day free trial with no credit card required.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-3xl shadow-xl overflow-hidden transition-all duration-300 ${
                plan.highlighted
                  ? 'ring-4 ring-purple-500 transform scale-105 lg:scale-110 z-10'
                  : 'hover:shadow-2xl hover:-translate-y-2'
              }`}
            >
              {/* Popular Badge */}
              {plan.highlighted && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold px-6 py-2 rounded-bl-2xl">
                  Most Popular
                </div>
              )}

              {/* Gradient Header */}
              <div className={`h-2 bg-gradient-to-r ${plan.gradient}`}></div>

              <div className="p-8">
                {/* Plan Name */}
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mb-4">
                  <span className={`text-5xl font-extrabold bg-gradient-to-r ${plan.gradient} bg-clip-text text-transparent`}>
                    {plan.price}
                  </span>
                  <span className="text-gray-500 ml-2">/{plan.period}</span>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-8 h-12">{plan.description}</p>

                {/* CTA Button */}
                <button
                  className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 ${
                    plan.highlighted
                      ? `bg-gradient-to-r ${plan.gradient} text-white hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105`
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </button>

                {/* Features List */}
                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <svg
                        className={`w-6 h-6 flex-shrink-0 ${
                          plan.highlighted ? 'text-purple-500' : 'text-green-500'
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            Need a custom plan? We've got you covered.
          </p>
          <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105">
            Contact Sales Team
          </button>
        </div>
      </div>
    </section>
  );
}
