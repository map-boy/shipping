const col1 = [
  { q: "Does YourBrand Cover My Area?", a: "Yes! There are couriers using YourBrand all over the country and abroad, so whether you need to move a sofa across town or send a car across Europe, we have got you covered." },
  { q: "Who Will Carry Out My Delivery?", a: "Whoever you choose! There are thousands of rated transport providers on our platform ready to make a bid to carry out your delivery. It is up to you to decide which quote to accept." },
  { q: "Does YourBrand Provide Packing Materials?", a: "If your item requires packing materials or extra care then you should make sure this is highlighted in your listing and discussed with any transport provider whose quote you are considering. Couriers on YourBrand are able to provide all levels of service and can help pack your items, just ensure you inform them of your needs." },
  { q: "Can I Travel With My Goods?", a: "The majority of transport providers on YourBrand are only insured for the transportation of goods, however, some are also able to take people. If you need to travel with your goods, make sure to mention this in your listing and to highlight this to any courier who quotes on your listing." },
  { q: "Does YourBrand Have Different Sized Vehicles?", a: "There are thousands of couriers on YourBrand, with a wide range of vehicle sizes capable of handling any delivery. Providing the rough dimensions (and pictures if possible) on your listing will allow the delivery company to get the right vehicle sent out to you." },
  { q: "When Will I Receive A Quote?", a: "You will typically start to receive quotes within 30 minutes. If you are worried about the lack of quotes, try adding some more detail to your listing as transport providers may be unsure of dimensions or weight and feel unable to provide an accurate quote." },
];

const col2 = [
  { q: "Will My Goods Be Tied Up Securely?", a: "Transport providers will almost always tie up an item in the transport vehicle, as the risk of damage from moving around during transit is high. You should always confirm safety precautions and packing needs with transport providers before accepting a quote." },
  { q: "What If I Need To Cancel My Booking?", a: "If you have accepted a quote and paid the deposit but wish to cancel the delivery, then you should first inform your chosen transport provider that you no longer require the delivery. You should then contact us to have your deposit refunded." },
  { q: "How Can I Contact YourBrand Support?", a: "YourBrand Support is available from 9am - 6pm Monday to Friday. You can send an email to our support team." },
  { q: "How Many Quotes Will I Receive?", a: "Whilst there is no guarantee of quotes, 98% of our listings receive at least 3 quotes, so you are likely to find someone who can undertake the delivery of your items." },
  { q: "Can Items Be Taken Upstairs?", a: "Yes, items can be taken upstairs if needed, and can also be assembled. Transport providers on YourBrand are happy to provide these services, but you should mention these requirements in your listing." },
  { q: "Can I Change The Address Of The Delivery?", a: "If you have not yet accepted a quote then you are able to change the address of your listing. Note that editing details after publishing will void active quotes, so you will have to wait for new ones." },
];

export default function FAQ() {
  return (
    <section id="help" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
      <div className="pb-20">
        <h2 className="text-3xl font-bold text-gray-900">FAQs</h2>
      </div>
      <div className="md:flex md:space-x-12 space-y-8 md:space-y-0">
        <div className="w-full md:w-1/2 space-y-8">
          {col1.map((faq) => (
            <div key={faq.q} className="space-y-2">
              <h4 className="text-xl font-bold text-gray-900">{faq.q}</h4>
              <p className="text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
        <div className="w-full md:w-1/2 space-y-8">
          {col2.map((faq) => (
            <div key={faq.q} className="space-y-2">
              <h4 className="text-xl font-bold text-gray-900">{faq.q}</h4>
              <p className="text-slate-500">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
