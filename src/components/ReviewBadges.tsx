export default function ReviewBadges() {
  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row justify-between text-center gap-8">
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">4.8/5 Rating</h3>
          <p className="text-gray-500 text-sm mt-1">from 4,108 Reviews</p>
        </div>
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
          </div>
          <p className="text-gray-600 text-sm">
            YourBrand is an official eBay compatible application
          </p>
        </div>
        <div className="md:w-1/3">
          <div className="flex justify-center mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">4.6/5 Rating</h3>
          <p className="text-gray-500 text-sm mt-1">from 28,861 Reviews</p>
        </div>
      </div>
    </section>
  );
}
