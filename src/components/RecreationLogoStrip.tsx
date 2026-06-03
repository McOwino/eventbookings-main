import villageRecreationLogo from "@/assets/Village_Recreation-Logo.png";

/** Solid #000 bar with the composite venue logos (reference layout). */
export function RecreationLogoStrip({ dense }: { dense?: boolean }) {
  return (
    <div
      className="w-full bg-black box-border"
      style={{
        padding: dense
          ? "clamp(10px, 2vw, 18px) clamp(12px, 3vw, 32px)"
          : "clamp(14px, 2.5vw, 28px) clamp(16px, 4vw, 48px)",
      }}
    >
      <img
        src={villageRecreationLogo}
        alt="The Yard Mini Golf, REV Virtual Racing, Ballpoint Social Club, Glitch, Ozone Trampoline Park, Under the Sea, Village Bowl, Village Market"
        className="mx-auto block h-auto w-full object-contain object-center"
        style={{
          maxHeight: dense ? "clamp(36px, 7vw, 56px)" : "clamp(48px, 10vw, 88px)",
        }}
      />
    </div>
  );
}
