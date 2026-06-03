import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Navigation, Thumbs } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { ImageIcon } from "lucide-react";

import { RecreationLogoStrip } from "@/components/RecreationLogoStrip";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";

export interface FacilitySlide {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

interface Props {
  slides: FacilitySlide[];
  loading?: boolean;
}

export function FacilityShowcase({ slides, loading }: Props) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);

  if (loading) {
    return (
      <section className="w-full bg-black">
        <RecreationLogoStrip />
        <div className="h-[min(52vw,420px)] animate-pulse bg-zinc-900" />
      </section>
    );
  }
  if (!slides.length) {
    return (
      <section className="w-full bg-black">
        <RecreationLogoStrip />
        <div className="flex h-60 items-center justify-center text-sm text-white/60">
          No facility slides yet.
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-black">
      <RecreationLogoStrip />

      <div className="mx-auto max-w-6xl px-4 pb-2 pt-4 sm:px-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-white/90">Our facility</h2>
        <p className="mt-1 max-w-lg text-sm text-white/55">
          Explore each venue — swipe or use arrows on tablet and desktop.
        </p>
      </div>

      <div className="facility-showcase w-full pb-4">
        <Swiper
          spaceBetween={0}
          speed={500}
          navigation
          thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
          modules={[FreeMode, Navigation, Thumbs]}
          className="facility-main-swiper w-full overflow-hidden"
        >
          {slides.map((s) => (
            <SwiperSlide key={s.id}>
              <div className="relative aspect-[21/9] w-full bg-zinc-950">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/40">
                    <ImageIcon className="h-10 w-10" />
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 text-white sm:p-6">
                  <h3 className="text-lg font-semibold sm:text-2xl">{s.title}</h3>
                  {s.description && (
                    <p className="mt-1 max-w-3xl whitespace-pre-line text-xs text-white/85 sm:text-sm">
                      {s.description}
                    </p>
                  )}
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <Swiper
          onSwiper={setThumbsSwiper}
          spaceBetween={10}
          slidesPerView={3.2}
          breakpoints={{
            640: { slidesPerView: 4.5 },
            900: { slidesPerView: 5.5 },
            1024: { slidesPerView: 6.5 },
          }}
          freeMode
          watchSlidesProgress
          speed={400}
          modules={[FreeMode, Navigation, Thumbs]}
          className="facility-thumbs-swiper mx-auto mt-3 max-w-6xl px-4 sm:px-6"
        >
          {slides.map((s) => (
            <SwiperSlide key={`t-${s.id}`} className="facility-thumb-slide cursor-pointer overflow-hidden rounded-lg">
              <div className="h-[52px] sm:h-[60px]">
                {s.image_url ? (
                  <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                    <ImageIcon className="h-5 w-5 text-white/30" />
                  </div>
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <style>{`
          .facility-showcase .facility-thumbs-swiper .swiper-slide {
            opacity: 0.5;
            transition: opacity 0.22s ease;
          }
          .facility-showcase .facility-thumbs-swiper .swiper-slide-thumb-active {
            opacity: 1;
            outline: 2px solid #c0272d;
            outline-offset: 2px;
            border-radius: 8px;
          }
          .facility-showcase .facility-main-swiper .swiper-button-next,
          .facility-showcase .facility-main-swiper .swiper-button-prev {
            color: #fff;
            background: rgba(0, 0, 0, 0.55);
            width: 42px;
            height: 42px;
            border-radius: 9999px;
            backdrop-filter: blur(6px);
          }
          .facility-showcase .facility-main-swiper .swiper-button-next::after,
          .facility-showcase .facility-main-swiper .swiper-button-prev::after {
            font-size: 16px;
            font-weight: 700;
          }
        `}</style>
      </div>
    </section>
  );
}
