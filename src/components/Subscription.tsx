import React from "react";

export default function Subscription() {
  return (
    <section className="fs-sub">
      <div className="fs-sub-marks" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i}>❀</span>
        ))}
      </div>
      <span className="fs-section-eyebrow">For businesses</span>
      <h2 className="fs-sub-title">Fresh flowers for your café, hotel or office, on a schedule.</h2>
      <p>
        Subscriptions are available for merchant stores. We agree your products and prices, then
        deliver every week, fortnight or month. Our team will set it up with you.
      </p>
      <div className="fs-sub-actions">
        <a className="fs-btn fs-btn--dark" href="#footer">Contact our team</a>
      </div>
    </section>
  );
}
