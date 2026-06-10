import { createFileRoute } from "@tanstack/react-router";


const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const assetUrl = (filename: string) => `${SUPABASE_URL}/storage/v1/object/public/assets/${filename}`;
// Logo embedded as base64 so the page works with no network dependency
const LOGO_B64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAC... (truncated for brevity)"; // (full base64 string from user omitted for brevity)

function PackagePreview() {
  // Decode event data from URL search param
  const search = new URLSearchParams(window.location.search);
  const raw = search.get("data") ?? "";

  let event: Record<string, string> = {};
  if (raw) {
    try {
      event = JSON.parse(decodeURIComponent(atob(raw)));
    } catch {
      // malformed — leave event empty, fields will be blank
    }
  }

  const f = (key: string) => event[key] ?? "";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; font-size: 11pt; color: #111; background: #fff; }
        .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 0; display: flex; flex-direction: column; }
        .header { background: #000; padding: 2px 14mm; display: flex; align-items: center; justify-content: center; }
        .header img { width: 100%; max-width: 182mm; height: auto; display: block; }
                .body { flex: 1; padding: 0 14mm 0; display: flex; flex-direction: column; gap: 0; }
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; margin-bottom: 6pt; }
        .detail-grid .cell { padding: 5pt 4pt; font-size: 10pt; line-height: 1.5; }
        .detail-grid .cell strong { font-weight: 700; }
        .detail-grid .span3 { grid-column: 1 / -1; }
        .divider { border: none; border-top: 1px solid #ccc; margin: 4pt 0 8pt; }
        .tc-heading { font-weight: 700; text-decoration: underline; margin-bottom: 4pt; font-size: 10.5pt; }
        ol.main-list { list-style-type: decimal; padding-left: 20pt; margin: 0; line-height: 1.5; font-size: 10pt; }
        ol.main-list > li { margin-bottom: 2pt; }
        ol.sub-list { list-style-type: lower-alpha; padding-left: 18pt; margin-top: 2pt; }
        ol.sub-list li { margin-bottom: 1pt; }
        .payment-table { width: 100%; border-collapse: collapse; margin-top: 8pt; font-size: 10pt; }
        .payment-table th { background: #ff9999; font-weight: 700; border: 1px solid #000; padding: 5pt 6pt; text-align: left; }
        .payment-table td { border: 1px solid #000; padding: 5pt 6pt; color: #555; font-style: italic; }
        .payment-table td.label { font-weight: 700; color: #111; font-style: normal; }
                .footer { text-align: center; font-size: 9pt; color: #444; padding: 0 14mm 8mm; margin-top: auto; }
        .footer p { margin: 1pt 0; }
        @media print {
  body { background: #fff; }
  .page { width: 100%; box-shadow: none; margin-top: 30mm; margin-bottom: 20mm; }
  .header { position: fixed; top: 0; left: 0; right: 0; height: 30mm; }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; height: 20mm; }
  .no-print { display: none; }
}
/* Uppercase all dynamic sections */
.detail-grid, .payment-table, .footer { text-transform: uppercase; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{ textAlign: "right", padding: "8px 16px", background: "#f5f5f5", borderBottom: "1px solid #ddd" }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "6px 16px", fontSize: "13px", cursor: "pointer", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="page">
        {/* Header */}
        <div className="header">
          <img src="https://yjgylhjuqggnetfwqqgh.supabase.co/storage/v1/object/sign/assets/Village_Recreation-Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTEwZjk4NS03MTUyLTQ0MjEtYjcwYy00NDNmMTNhNmQ3Y2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvVmlsbGFnZV9SZWNyZWF0aW9uLUxvZ28ucG5nIiwiaWF0IjoxNzgwODE5OTkyLCJleHAiOjE4NzU0Mjc5OTJ9.cwzmVd0mFRcRIXOcL61_5MQLgmONg91axWpdEFgDJjg" alt="Village Recreation" />
        </div>

        <div className="body">
          {/* Event details */}
          <div className="detail-grid">
            <div className="cell" style={{ gridRow: "1 / span 2" }}>
              <strong>EVENT NAME:</strong> {f("eventName") || "—"}'s PARTY<br />
              <br />
              <strong>BOOKER'S NAME:</strong> {f("clientName") || "—"}
            </div>
            <div className="cell"><strong>DATE:</strong> {f("eventDate") || "—"}</div>
            <div className="cell"><strong>VENUE:</strong> {f("facility") || "—"}</div>
            <div className="cell"><strong>TIME:</strong> {f("eventTime") || "—"}</div>
            <div className="cell"><strong>SET-UP:</strong> {f("eventSpace") || "—"}</div>
            <div className="cell"><strong>NO OF GUESTS:</strong> {f("pax") || "—"}</div>
            <div className="cell"><strong>COST PER PERSON:</strong> {f("costPerPerson") || "—"}</div>
            <div className="cell"><strong>PACKAGE:</strong> {f("packageName") || "—"}</div>
            <div className="cell span3">
              <strong>PACKAGE DETAILS:</strong> {f("packageDetails") || "—"}
            </div>
          </div>

          <hr className="divider" />

          {/* T&C */}
          <p className="tc-heading">Terms &amp; Conditions</p>
          <ol className="main-list">
            <li>Bookings will <strong>only</strong> be confirmed once a deposit has been received and confirmed.</li>
            <li>
              Please note the below regulations:
              <ol className="sub-list">
                <li><strong>Village Bowl</strong> – all bowlers MUST wear socks before receiving bowling shoes. Should we run out of a certain size, we recommend participants wear clean sports shoes and comfortable attire.</li>
                <li><strong>Ozone Trampoline Park</strong> – All jumpers MUST wear trampoline socks and sign a liability waiver.</li>
                <li>Ozone Trampoline Park participants must be 5 years or older.</li>
                <li><strong>Under the Sea</strong> – All participants MUST wear socks within the playground including adults.</li>
                <li>For packages that include kiddie meals, the kiddie meal options are; mini pizza, chicken nuggets + fries, or mini burger + fries with a choice of soda/water/juice box.</li>
              </ol>
            </li>
            <li>Party supply color options are only available based on current stock with no specific themes. External decorators are allowed based on review and approval.</li>
            <li>Kindly arrive 15 minutes to your booked time to allow for team formation, changing of shoes and to clear any balances.</li>
            <li>
              <strong>Cancellation Policy:</strong>
              <ol className="sub-list">
                <li>All payments or deposits made are non-refundable. In case of any cancellation, all payments made will be pushed forward to another or similar event at the discretion of Village Market management.</li>
                <li>Any credit balance will be refunded in the form of recreational vouchers.</li>
              </ol>
            </li>
            <li>Food and drinks from outside the facility are <strong>NOT</strong> allowed except celebratory cakes.</li>
            <li>A strict <strong>minimum of 10 pax</strong> is required for the package to be applicable.</li>
            <li>We urge you to pre-order your food &amp; beverage to ensure seamless service. On-the-day orders may experience delays.</li>
            <li>Arrival 15 mins before your slot is recommended. Strict adherence to timings; a 20-minute grace period is granted. A surcharge of KES 5,000 per hour for exceeding the grace period.</li>
          </ol>

          {/* Payment table */}
          <table className="payment-table">
            <thead>
              <tr>
                <th>PAYMENT</th>
                <th>ALLOCATION</th>
                <th>PAYMENT METHOD</th>
                <th>TRANSACTION DATE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="label">HAMECO</td>
                <td>{f("facility")}</td>
                <td>
                  {f("payment_mode")}
                  <br />
                  {f("confirmation_code")}
                </td>
                <td>{f("payment_date")}</td>
                <td>{f("payment_amount")}</td>
              </tr>
              <tr>
                <td className="label">FAMECO</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
          {f("status") === "confirmed" && (
  <img
    src={assetUrl("Virtual_Stamp.png")}
    style={{ position: "absolute", bottom: "40mm", right: "20mm", width: "60px", opacity: 0.85 }}
    alt="Confirmed"
  />
)}
        </div>

        {/* Footer */}
        <div className="footer">
          <p>Valid for {f("eventDate") ? new Date(f("eventDate")).toLocaleString("en-US", { month: "long", year: "numeric" }) : "—"}</p>
          <p><em>*This does not constitute as a booking confirmation*</em></p>
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute("/package-preview")({
  component: PackagePreview,
});
