const villageRecreationLogo = "https://yjgylhjuqggnetfwqqgh.supabase.co/storage/v1/object/sign/assets/Village_Recreation-Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTEwZjk4NS03MTUyLTQ0MjEtYjcwYy00NDNmMTNhNmQ3Y2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvVmlsbGFnZV9SZWNyZWF0aW9uLUxvZ28ucG5nIiwiaWF0IjoxNzgwODE5OTkyLCJleHAiOjE4NzU0Mjc5OTJ9.cwzmVd0mFRcRIXOcL61_5MQLgmONg91axWpdEFgDJjg";

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
