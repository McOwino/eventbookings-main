import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay, Navigation, FreeMode } from "swiper/modules";
import { Sparkles, Tag, MapPin, Hourglass, CalendarClock } from "lucide-react";
import { activePromotionsQueryOptions } from "@/lib/queries";
import type { Promotion } from "@/lib/events-data";
import { useEffect, useState } from "react";

import { RecreationLogoStrip } from "@/components/RecreationLogoStrip";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (Number.isNaN(diff) || diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes };
}

function Validity({ endsOn }: { endsOn: string }) {
  const [left, setLeft] = useState(() => getTimeLeft(endsOn));
  useEffect(() => {
    const id = setInterval(() => setLeft(getTimeLeft(endsOn)), 60_000);
    return () => clearInterval(id);
  }, [endsOn]);
  if (!left) return <span>Ended</span>;
  if (left.days > 0) return <span>{left.days}d {left.hours}h left</span>;
  return <span>{left.hours}h {left.minutes}m left</span>;
}

function PromoCard({ promo }: { promo: Promotion }) {
  const isHot = promo.kind === "Limited-time offer";
  return (
    <article className="promo-poster-card">
      <div className="poster-image">
        {promo.imageUrl ? (
          <img src={promo.imageUrl} alt={promo.title} loading="lazy" className="poster-img" />
        ) : (
          <div className={`h-full w-full bg-gradient-to-br ${promo.imageHue}`} />
        )}
        <div className={`poster-overlay ${isHot ? "badge-hot" : ""}`}>
          <Tag className="mr-1 -mt-0.5 inline h-3 w-3" />
          {promo.kind}
        </div>
      </div>
      <div className="promo-content">
        <h3 className="promo-title">{promo.title}</h3>
        <div className="promo-desc-list">
          {promo.description ? (
            <div className="detail-chip">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span>{promo.description}</span>
            </div>
          ) : null}
          <div className="detail-chip">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>
              <span className="highlight">{promo.facility}</span>
            </span>
          </div>
          <div className="detail-chip">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span>
              Ends{" "}
              {new Date(promo.endsOn).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="validity-row">
          <Hourglass className="h-3 w-3" />
          <Validity endsOn={promo.endsOn} />
        </div>
      </div>
    </article>
  );
}

export function ActivePromotions() {
  const { data, isLoading } = useQuery(activePromotionsQueryOptions());
  const promos = data ?? [];

  if (isLoading) {
    return (
      <section className="vm-promo-dark active-promotions-root bg-black">
        <RecreationLogoStrip dense />
        <div className="promo-carousel-container mx-auto px-4 sm:px-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Active promotions</h2>
          <p className="text-sm text-white/55">Loading…</p>
        </div>
      </section>
    );
  }
  if (promos.length === 0) return null;

  return (
    <section className="vm-promo-dark active-promotions-root bg-black text-white">
      <RecreationLogoStrip dense />

      <div className="promo-carousel-container mx-auto px-4 pt-6 sm:px-6">
        <header className="carousel-header">
          <h2 className="promo-section-title text-white">
            <Sparkles className="inline h-7 w-7 text-[#c0272d]" />
            Promotions &amp; Events
          </h2>
          <p className="text-white/55">
            Limited-time offers — swipe or use arrows on tablet and desktop.
          </p>
        </header>

        <Swiper
          modules={[Pagination, Autoplay, Navigation, FreeMode]}
          slidesPerView="auto"
          spaceBetween={16}
          loop={promos.length > 2}
          pagination={{ clickable: true, dynamicBullets: true }}
          autoplay={{ delay: 5500, disableOnInteraction: false, pauseOnMouseEnter: true }}
          navigation
          freeMode={{ momentum: true, momentumRatio: 0.85 }}
          speed={500}
          className="active-promo-swiper"
        >
          {promos.map((p) => (
            <SwiperSlide key={p.id} className="active-promo-slide !h-auto">
              <PromoCard promo={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
