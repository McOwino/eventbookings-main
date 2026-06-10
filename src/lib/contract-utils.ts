export const FACILITY_TILL: Record<string, string> = {
  village_bowl:          "5541291",
  under_the_sea:         "9840427",
  ozone_trampoline_park: "9840429",
  mini_golf:             "9840415",
  rev:                   "9840417",
  glitch:                "9840425",
  ballpoint:             "9840423",
};

// Human-readable facility name (matches VMR HTML labels)
export const FACILITY_LABEL: Record<string, string> = {
  village_bowl:          "Village Bowl",
  under_the_sea:         "Under the Sea",
  ozone_trampoline_park: "Ozone Trampoline Park",
  mini_golf:             "Mini-Golf",
  rev:                   "REV",
  glitch:                "Glitch",
  ballpoint:             "Ballpoint",
};

export interface ContractData {
  etype: string;
  fac: string;
  name: string;
  contact: string;
  email: string;
  org: string;
  eventSpace?: string | null;
  pkg: string;
  pax: number | string;
  cpp: number | string;
  startTime: string;
  endTime: string;
  notes: string;
  till: string;
  bdayPersons: { name: string; dob: string }[];
  schPkgs: string[];
  evtDate: string;
  today: string;
  total: number;
  eventId?: string | null;
  sigDataURL?: string;
}

export function fmt(t: string): string {
  if (!t) return "";
  const [hs, ms] = t.split(":");
  const h = Number(hs ?? 0);
  const m = Number(ms ?? 0);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function row(k: string, v: string): string {
  return `<div class="data-row"><div class="dk">${k}</div><div class="dv">${v || "—"}</div></div>`;
}

export async function fetchStampUrl(): Promise<string> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("app_assets")
    .select("url")
    .eq("key", "company_stamp")
    .single();
  return data?.url ?? "https://yjgylhjuqggnetfwqqgh.supabase.co/storage/v1/object/public/assets/Virtual_Stamp.png";
}

export function buildContractHTML(d: ContractData, withSig = false, stampUrl?: string): string {
  const sig =
    withSig && d.sigDataURL
      ? `<img src="${d.sigDataURL}" style="max-height:60px;display:block;margin-top:4px;">`
      : `<div style="border-bottom:1px solid #0f0e0d;height:60px;margin-top:4px;"></div>`;

  const org = d.org || d.name;
  const titles: Record<string, string> = {
    birthday: "BIRTHDAY PARTY AGREEMENT",
    school_trip: "SCHOOL TRIP AGREEMENT",
    hangout: "HANGOUT / CORPORATE AGREEMENT",
  };

  const facLabel = FACILITY_LABEL[d.fac] ?? d.fac;

  let eRows = "";
  if (d.etype === "birthday") {
    const bl = (d.bdayPersons ?? [])
      .map(
        (p) =>
          `${p.name}${p.dob ? " (DOB: " + new Date(p.dob + "T12:00:00").toLocaleDateString("en-GB") + ")" : ""}`,
      )
      .join(", ");
    eRows =
      row("Event Date", d.evtDate) +
      row("Start Time", fmt(d.startTime)) +
      row("End Time", fmt(d.endTime)) +
      row("Duration", "3 hours") +
      row("Facility", facLabel) +
      row("Package", d.pkg) +
      row("Birthday Person(s)", bl) +
      row("Number of Persons", `${d.pax} PAX`) +
      row("Cost per Person", `KES ${Number(d.cpp).toLocaleString()}`) +
      row("Estimated Total", `KES ${Number(d.total).toLocaleString()}`);
  } else if (d.etype === "school_trip") {
    const pl =
      (d.schPkgs ?? [])
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(", ") || "None";
    eRows =
      row("Event Date", d.evtDate) +
      row("Start Time", fmt(d.startTime)) +
      row("End Time", fmt(d.endTime)) +
      row("Facility", facLabel) +
      row("Package Options", pl) +
      row("Number of Persons", `${d.pax} PAX`) +
      row("Cost per Person", `KES ${Number(d.cpp).toLocaleString()}`) +
      row("Estimated Total", `KES ${Number(d.total).toLocaleString()}`);
  } else {
    eRows =
      row("Event Date", d.evtDate) +
      row("Start Time", fmt(d.startTime)) +
      row("End Time", fmt(d.endTime)) +
      row("Facility", facLabel) +
      row("Package", d.pkg) +
      row("Number of Persons", `${d.pax} PAX`) +
      row("Cost per Person", `KES ${Number(d.cpp).toLocaleString()}`) +
      row("Estimated Total", `KES ${Number(d.total).toLocaleString()}`);
  }

  // Append Venue as last row in Event Details for all contract types
  eRows += row("Venue", (d.eventSpace as string) || "—");

  const venueInc =
    d.etype === "birthday"
      ? `<h2>Venue Rental Includes</h2><ol>
          <li>Simple balloon décor, paper plates &amp; cups</li>
          <li>Party host and F&amp;B person</li>
          <li>Parking validation for 2 cars &amp; 1 gift voucher for birthday child</li>
          <li>Tables &amp; chairs set up</li>
          ${/kiddie fiesta|immersive delights/i.test(d.pkg) ? `<li>Kiddie meal for ${d.pax} PAX</li>` : ""}
         </ol>`
      : "";

  // Payment section: Birthday uses a specific deposit rule; other event types (school_trip, hangout/other)
  // should render the same two-column table (M-Pesa Till + Bank Transfer) as the birthday tabular format.
  let payment = "";
  if (d.etype === "birthday") {
    payment = `<h2>3. Fees &amp; Payment</h2>
         <p>A deposit equivalent to payment for 10 PAX is required to secure the booking. Balance due on the day of the event before services are rendered.</p>
         <table class="payment-table">
           <tr>
             <td class="dk">Games M-Pesa</td>
             <td class="dk">Bank Transfer</td>
           </tr>
           <tr>
             <td class="dv">Till: <strong>${d.till}</strong> (Hameco)</td>
             <td class="dv">Hameco Limited | KCB A/C 1108771513 | Branch 01-180</td>
           </tr>
         </table>`;
  } else {
    payment = `<h2>3. Fees &amp; Payment</h2>
         <p>A deposit of 50% is required to secure the space; balance cleared at least 48 hours before the event.</p>
         <table class="payment-table">
           <tr>
             <td class="dk">Games M-Pesa</td>
             <td class="dk">Bank Transfer</td>
           </tr>
           <tr>
             <td class="dv">Till: <strong>${d.till}</strong> (Hameco)</td>
             <td class="dv">Hameco Limited | KCB A/C 1108771513 | Branch 01-180</td>
           </tr>
         </table>`;
  }

  const bdayTerms =
    d.etype === "birthday"
      ? `<h2>8. Terms &amp; Conditions</h2>
         <p><strong>Pre-Event:</strong> Confirmed upon deposit + signed agreement. Pre-order F&amp;B recommended. Communicate dietary needs in advance. External decorations require prior approval.</p>
         <p><strong>During:</strong> Arrive 15 minutes early. Late arrivals cannot extend time. Outside food/beverages prohibited except birthday cakes or fruit. Adult supervision required. Damage paid in full.</p>
         <p><strong>Post-Event:</strong> 20-minute grace period. Exceeding incurs KES 5,000/hr surcharge (KES 10,000 for Immersive Room).</p>
         <p><strong>General:</strong> No alcohol in Ozone/Under the Sea rooms. Socks mandatory at Under the Sea; grip socks at Ozone (KES 250/pair). First-time participants sign liability form.</p>`
      : "";

  const clauseN = d.etype === "birthday" ? "9" : "8";

  return `
    <h1>VILLAGE MARKET RECREATION<br>${titles[d.etype] ?? "EVENT AGREEMENT"}</h1>
    <div class="sub-center">
      This agreement is entered into on <strong>${d.today}</strong> by and between<br>
      <strong class="hameco">Hameco Limited</strong> — Reg. No. C.13452, P.O. Box 200–00621, Village Market, Nairobi (the "Venue")<br>
      and <strong class="client-name">${org}</strong> (the "Client")
    </div>
    <h2>1. Event Description</h2>${eRows}${venueInc}
    <h2>2. Confirmation of Attendees</h2>
    <p>Final guaranteed attendee count is due 3 business days before the event. The Client is responsible for the greater of the guaranteed or actual count. If the final count is below 90%, the Client pays the originally contracted count.</p>
    ${payment}
    <h2>4. Cancellation Policy</h2>
    <p>Cancellations must be made in writing at least 72 hours prior to the event. No-refund policy applies; funds may be applied to a similar future event at the Venue's discretion.</p>
    <h2>5. Indemnification</h2>
    <p>The Client agrees to indemnify and hold harmless the Venue, its employees, agents, and contractors from any claims, damages, losses, and expenses arising out of or in connection with this Agreement.</p>
    <h2>6. Force Majeure</h2>
    <p>Neither party shall be liable for failure to perform obligations resulting from causes beyond their reasonable control.</p>
    <h2>7. Entire Agreement</h2>
    <p>This Agreement constitutes the entire agreement between the parties and supersedes all prior agreements, whether oral or written.</p>
    ${bdayTerms}
    <h2>${clauseN}. Governing Law</h2>
    <p>This Agreement shall be governed by and construed in accordance with the laws of Kenya.</p>
    ${d.notes ? `<h2>Additional Notes</h2><p>${d.notes}</p>` : ""}
    <div class="sig-sig-area">
      <div class="sig-block">
        <strong>Signed on behalf of HAMECO LIMITED</strong>
        <div style="margin-top:10px;font-size:13px;"><strong>Name:</strong> <span class="sig-answer">VICTOR OTIENO</span></div>
        <div style="margin-top:8px;font-size:13px;"><strong>Designation:</strong> <span class="sig-answer">GENERAL MANAGER</span></div>
        <div style="margin-top:8px;font-size:13px;"><strong>Date:</strong> <span class="sig-answer">${d.today}</span></div>
        <div style="margin-top:12px;font-size:11px;color:#888;">Company Stamp:</div>
        <img src="${stampUrl ?? "https://yjgylhjuqggnetfwqqgh.supabase.co/storage/v1/object/public/assets/Virtual_Stamp.png"}" style="max-height:80px;display:block;margin-top:8px;">
      </div>
      <div class="sig-block">
        <strong>Signed by Client</strong>
        <div style="margin-top:6px;"><strong class="client-name">${d.name}</strong></div><div class="sig-label">Name</div>
        <div style="margin-top:14px;"><span class="sig-answer">${facLabel}</span></div><div class="sig-label">Facility</div>
        <div style="margin-top:14px;">${sig}<div class="sig-label" style="margin-top:4px;">Signature</div></div>
        <div style="margin-top:16px;"><span class="sig-answer">${d.today}</span></div><div class="sig-label">Date</div>
      </div>
    </div>`;
}
