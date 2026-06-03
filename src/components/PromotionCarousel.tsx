import { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCoverflow, Navigation, Pagination, Autoplay } from "swiper/modules";
import { type Promotion } from "@/lib/events-data";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";
import "swiper/css/pagination";

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

function CountdownBadge({ endsOn }: { endsOn: string }) {
  const [left, setLeft] = useState(() => getTimeLeft(endsOn));

  useEffect(() => {
    const id = setInterval(() => setLeft(getTimeLeft(endsOn)), 1000);
    return () => clearInterval(id);
  }, [endsOn]);

  if (!left) {
    return (
      <div className="countdown-badge">
        <span className="countdown-label">Ended</span>
      </div>
    );
  }

  const cell = (val: number, label: string) => (
    <div className="countdown-cell">
      <span className="countdown-value">{String(val).padStart(2, "0")}</span>
      <span className="countdown-unit">{label}</span>
    </div>
  );

  return (
    <div className="countdown-badge">
      {cell(left.days, "d")}
      <span className="countdown-sep">:</span>
      {cell(left.hours, "h")}
      <span className="countdown-sep">:</span>
      {cell(left.minutes, "m")}
      <span className="countdown-sep">:</span>
      {cell(left.seconds, "s")}
    </div>
  );
}

export function PromotionCarousel({ promos }: { promos: Promotion[] }) {
  if (promos.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/70">
        No active promotions.
      </div>
    );
  }

  return (
    <div className="promo-carousel relative">
      <Swiper
        modules={[EffectCoverflow, Navigation, Pagination, Autoplay]}
        effect="coverflow"
        grabCursor
        centeredSlides
        loop={true}
        loopAdditionalSlides={promos.length}
        slidesPerView="auto"
        speed={2000}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        coverflowEffect={{
          rotate: 0,
          stretch: 0,
          depth: 200,
          modifier: 1,
          slideShadows: false,
        }}
        navigation={{ nextEl: ".promo-next", prevEl: ".promo-prev" }}
        pagination={{ clickable: true, el: ".promo-pagination" }}
        className="!pb-12"
      >
        {promos.map((p) => (
          <SwiperSlide key={p.id} className="promo-slide">
            <div className="promo-card">
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.title} loading="lazy" />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${p.imageHue}`} />
              )}
              <CountdownBadge endsOn={p.endsOn} />
              <div className="slide-content">
                <h2>{p.title}</h2>
                <p>{p.description}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <button
        className="promo-prev swiper-nav-btn left-2 sm:left-6"
        aria-label="Previous promotion"
        type="button"
      >
        <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: "rotate(180deg)" }}>
          <path d="M0.38 20.08c-.27-.27-.27-.71 0-.98L9.2 10.28.38 1.46c-.27-.27-.27-.71 0-.98s.71-.27.98 0l9.07 9.07c.4.4.4 1.05 0 1.45l-9.07 9.07c-.27.27-.71.27-.98 0Z" fill="currentColor" />
        </svg>
      </button>
      <button
        className="promo-next swiper-nav-btn right-2 sm:right-6"
        aria-label="Next promotion"
        type="button"
      >
        <svg width="11" height="20" viewBox="0 0 11 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0.38 20.08c-.27-.27-.27-.71 0-.98L9.2 10.28.38 1.46c-.27-.27-.27-.71 0-.98s.71-.27.98 0l9.07 9.07c.4.4.4 1.05 0 1.45l-9.07 9.07c-.27.27-.71.27-.98 0Z" fill="currentColor" />
        </svg>
      </button>

      <div className="promo-pagination !relative !bottom-0 mt-2 flex justify-center" />
    </div>
  );
}
