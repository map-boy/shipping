export default function ReviewBadges() {
  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between text-center gap-8">
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <svg className="w-10 h-10 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">4.8/5 Rating</h3>
          <p className="text-gray-500 text-sm mt-1">from 4,108 Reviews</p>
        </div>
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 text-sm">
            TikTak is an official eBay compatible application
          </p>
        </div>
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <svg className="w-10 h-10 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 15.27L16.18 19l-1.64-7.03L20 7.24l-7.19-.61L10 0 7.19 6.63 0 7.24l5.46 4.73L3.82 19z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900">4.6/5 Rating</h3>
          <p className="text-gray-500 text-sm mt-1">from 28,861 Reviews</p>
        </div>
      </div>
    </section>
  );
}
