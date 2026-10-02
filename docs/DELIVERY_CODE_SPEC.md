# Delivery Code — idea appraisal, risk analysis, and UX design

Status: **proposal, nothing built.** Written to decide whether to build it, and
how, before any code is written.

---

## 1. Is the idea good?

**Yes — but it is not new, and that is the most useful thing in this document.**

Delivery PINs already exist, widely:

| Who | What they do |
| --- | --- |
| Amazon | OTP on high-value items; customer reads a code to the courier |
| Flipkart / Myntra | Delivery OTP as standard |
| Swiggy, Zomato, Dunzo, Glovo, Bolt Food | PIN on selected orders |
| **GIG Logistics, Kwik, Sendbox, Fez, Gokada (Nigeria)** | delivery codes already in production |

So the pitch cannot be "nobody has this." Any small business owner who has ever
shipped with GIG has seen a delivery code. The honest pitch is:

> You get the thing GIG has, for your own riders, without handing your
> deliveries to GIG.

That is still a good pitch. Most SaaS is won on packaging, price and
distribution, not novelty.

### What is genuinely yours

Two things in this idea are better than what the incumbents ship:

**1. The rejection path.** Almost every delivery-PIN implementation is binary:
delivered or not. The idea here — the customer inspects *in front of the
driver*, and refusing produces a photograph and a reason rather than just a
failure — is better than Amazon's version. This is the part to lead with in
marketing, because it is the part a customer can feel.

**2. You already know where the driver is.** Nobody at this price point can bind
a code redemption to a GPS fix. If a code is redeemed 3 km from the drop-off
address, that is a fact worth surfacing, and it falls out of infrastructure you
have already built and paid for. A standalone PIN app cannot do it.

The combination — live tracking + geofenced handover + code + photo receipt +
evidenced rejection — is the moat. Thin, but real.

### What it is worth

- **Problem is real.** Nigerian commerce runs on pay-on-delivery precisely
  because of the trust deficit this addresses.
- **Build cost is moderate.** The schema already anticipates it (see §4).
- **Willingness to pay is unvalidated.** ₦3,000/month is a plausible number,
  but nobody has said yes to it yet. See §5 for how to test that before
  building the whole thing.

---

## 2. What is wrong with the idea as described

Nine problems, in the order they will hurt. Each with a fix.

### A. The code does not stop the scam you described

The scam: a fake "vendor" tells a real vendor to deliver to person B, and tells
person B to pay person C. The code confirms **handover**. It says nothing about
where the money went, because FleetTrackMate never touches the money.

What the code actually buys you is an **evidence trail** that makes the dispute
resolvable: who received the goods, when, where, and what they looked like.
That is genuinely valuable. It is not fraud prevention.

**Fix: market it as proof, not protection.** Overclaiming here invites both a
reputation problem and, in Nigeria, a regulatory one. If you ever genuinely want
to stop the payment scam you need **escrow** — holding the buyer's money and
releasing it on code redemption — and that is a different company: CBN
licensing or a licensed partner, KYC, settlement, chargebacks. **Not v1.**
Revisit at v3 with a payments partner, never alone.

### B. Coercion at the door is the real failure mode

The driver is physically present. The customer is often alone, sometimes at
night. "Give me the code or I take it back" works on most people.

**Fixes:**
- The customer page states plainly: *you do not owe anyone this code until you
  are satisfied, and the item is already yours.*
- A **"I'm being pressured"** button on the customer page that alerts the
  business owner instantly, with the driver's live position attached. Cheap to
  build, and no competitor at this price has it.
- Log the gap between *code viewed* and *code redeemed*. A driver whose
  deliveries are consistently redeemed within 20 seconds is pressuring people.
  Surface that pattern to the owner.

### C. Code leakage destroys the entire feature

In practice the customer reads the code out the moment the driver appears,
before opening anything. Protection gone.

**Fix — and this is the single highest-leverage decision in the document:**
do not put the bare code at the top of the message. Lead with one short
instruction, *then* the code.

```
Only give this code after you have checked your item.

      4 8 2 9 1 7

This code confirms you received your order from <Business>.
Check the item first. If something is wrong, do not give the code —
tap here to report it instead:  <link>
```

You asked for the code boldly first. The code is still the biggest thing on the
screen and still impossible to miss — but one line above it changes behaviour at
the door, and costs nothing. **This is your call, but I would not ship it the
other way round.**

### D. The driver may not have the app — this is the market-sizing problem

If codes can only be redeemed inside the driver app, your market shrinks to
businesses that already run dedicated drivers on FleetTrackMate. A shop owner
who calls an okada rider is excluded, and that is most of the market you
described wanting.

**Fix: two redemption paths.**

1. **In-app** (driver has FleetTrackMate) — full experience, GPS-bound, works
   offline.
2. **Web link** — the rider gets an SMS with a one-page form: enter code, take
   photo, done. No install. Browser geolocation where granted.

This roughly triples the addressable market and is not much extra work, because
the customer page (§3.2) is already a public token-addressed page.

### E. Brute force

A 4-digit code is 10,000 combinations and a dishonest rider with the web form
can sit and guess.

**Fix:** 6 digits, maximum 5 attempts, 15-minute lockout, alert the owner on the
3rd failure. Never distinguish "wrong code" from "expired code" in the error
text — that is free information for an attacker.

### F. Expiry should run from dispatch, not creation

A job created Monday for Friday delivery would arrive with a 4-day-old code.

**Fix:** the code becomes live when the driver marks *en route* (or at creation
if that stage is skipped) and expires N hours later. Default 24h, owner
adjustable 15 min – 7 days as you wanted.

### G. The reverse scam: the customer refuses the code

Customer takes the goods, withholds the code, claims non-delivery. The driver is
now unpaid and furious. Build this or drivers will sabotage the feature.

**Fix:** driver can file **"customer refused to give the code"** with photo and
GPS. It goes to the owner to adjudicate, and it is visible in the driver's
record so a driver who cries wolf is also visible.

### H. It must work offline

You already know drivers lose signal. If code verification needs the network, a
basement delivery blocks the receipt and the driver is stranded.

**Fix:** ship a **salted hash** of the code with the job when it is downloaded.
Verify on-device, queue the redemption. This drops straight into the offline
queue you just rebuilt — the redemption is one more thing that drains on
reconnect.

### I. Channel cost will decide your margin

- **SMS (Nigeria):** registered sender ID required; roughly ₦3–4 per message via
  Termii / Africa's Talking / Twilio. 100 deliveries/month ≈ ₦300–400 of pure
  cost against a ₦3,000 subscription.
- **WhatsApp Business API:** template pre-approval, per-conversation pricing,
  and weeks of setup. Do not block v1 on it.
- **Email:** nearly free, but Nigerian retail customers often will not read it.

**Fix for v1 — use click-to-chat, not the API:**

```
https://wa.me/<customer-number>?text=<url-encoded message>
```

The owner taps *Send on WhatsApp*, their own WhatsApp opens with the message
already written to that customer, they press send. **Zero API cost, zero
approval, available today.** Most small business owners already run their whole
business through WhatsApp, so this matches how they work.

Bundle: unlimited email + unlimited WhatsApp click-to-chat + a quota of ~100
SMS, metered beyond that.

---

## 3. The UX

**Governing rule: minimal but purposeful.** Nothing on a screen that is not
doing a job. No explanatory prose on any surface the owner sees daily. Every
destination answers "what is this for?" in one phrase or it does not exist.

Applied here, that means one hard constraint: **this feature adds no tab, no
dashboard widget and no new section.** It is a property of a job. The entire
owner-facing surface is one toggle inside a form they already use.

### 3.1 Business owner — one toggle, then four fields

The existing **Assign job** form. The block below the rule appears only when the
toggle is on.

```
  Driver        [ Musa Ibrahim        ▾ ]
  What is it    [ 2 cartons of tiles    ]
  Drop-off      [ 14 Awolowo Rd, Ikoyi  ]
  ──────────────────────────────────────
  Delivery code                    [ ON ]
  Driver can't finish without it.

  Customer      [ Mrs Adeyemi           ]
  Phone         [ 0803 000 0000         ]
  Expires       [ 24 hours            ▾ ]
  Send by       [✓] WhatsApp  [ ] SMS
  ──────────────────────────────────────
            [    Send job    ]
```

- **Off by default.** Most jobs do not need it, and a feature that imposes
  itself gets switched off entirely.
- **One line of explanation, not two** — and it describes the consequence
  (`driver can't finish`), not the mechanism. That is the only training the
  owner gets and the only sentence on the screen.
- Email is behind the channel row, not a fourth visible field. Phone covers
  WhatsApp and SMS both.

### 3.2 Customer — one number and two choices

Public page, token in the URL, no login, no install. The audience has never seen
your product and will not read instructions, so there are none.

```
  ┌───────────────────────────────┐
  │  Kemi's Tiles                 │
  │                               │
  │  Check your item first,       │
  │  then give the driver:        │
  │                               │
  │      4 8 2 9 1 7              │   ← huge, tabular, selectable
  │                               │
  │  Expires in 23h 41m           │
  ├───────────────────────────────┤
  │  Something's wrong with it  › │
  │  Where's my driver?         › │
  └───────────────────────────────┘
```

Six words carry the whole protocol: *check your item first, then give the
driver*. An earlier draft of this spec had a four-step numbered explainer here —
that is exactly the write-up this product is trying to remove. The one line does
the same work and gets read, which the four steps would not.

- **"Something's wrong"** opens the camera directly. Up to 3 photos, one reason
  from a short list, free text optional. Fires to the owner immediately. The
  "I'm being pressured" alert from §2.B lives *inside* this flow as one of the
  reasons — it does not earn its own row.
- **"Where's my driver?"** reuses existing tracking. It is what makes this feel
  like a product rather than a text message.
- Selectable text, never an image. Must work on a cheap Android browser.

### 3.3 Driver — one gate

```
  2 cartons of tiles
  14 Awolowo Rd, Ikoyi
  ─────────────────────────────────
  Ask Mrs Adeyemi for her code

    [_] [_] [_] [_] [_] [_]

  Couldn't get the code?         ›
  ─────────────────────────────────
  🔒 Photo unlocks after the code
```

After a correct code the gate is replaced, not added to:

```
  ✅ Code confirmed · at the drop-off
  ─────────────────────────────────
  📷 Take delivery photo          ›
```

- The locked photo row stays **visible**. A driver who cannot see why he is
  stuck assumes the app is broken — the exact mistake that made the station
  receipt look dead for a month. Six words prevent a support call.
- `at the drop-off` / `1.4 km from the drop-off` is computed from the fix at
  redemption. One phrase, no label, no card. It is the line that wins a dispute.
- Six boxes, numeric keypad, auto-advance. No paste field, no "verify" button —
  the sixth digit submits.

### 3.4 Job states

```
  assigned → code_sent → en_route → ┬→ code_verified → delivered
                                    ├→ rejected_by_customer (photos)
                                    ├→ code_refused (driver reports)
                                    └→ code_expired
```

These surface as a **status word on the existing job row** — not a new screen,
not a badge system. `rejected_by_customer` is the one worth a detail view,
because it is the receipt for goods coming back.

---

## 4. Keeping the two codes apart

There are now two things called a "code" and they must never blur — not in the
UI, not in conversation, not in the schema. They are different in every way that
matters:

| | Driver connection code | Delivery code |
| --- | --- | --- |
| Who holds it | the **driver** | the **customer** |
| What it grants | access to your fleet | confirmation of one handover |
| Lifespan | months, until revoked | one delivery — minutes to days |
| How many | one per vehicle | one per job |
| Reused | every single day | never, single-use |
| If it leaks | a stranger appears on your map | one delivery is falsely confirmed |
| Lives under | **Fleet** | **Jobs** |

### The structural rule

**They never appear on the same screen, and the delivery code gets no screen of
its own.**

A delivery code is a property of a job, shown on that job, created in the job
form. There is no "Delivery codes" list, no "Codes" section containing both.
This is the strongest anti-confusion measure available: two things cannot be
mistaken for each other if one of them does not have a page.

If a list is ever genuinely needed, it belongs under **Jobs** as a filter —
*"Jobs awaiting code"* — never as a section called "Codes".

### UI changes this requires

The existing screen at `/app/admin/codes` is titled **"Drivers & codes"** and
its copy says "Ready to hand out", "Issue a new code?", "Delete this code?".
Every one of those is ambiguous the moment delivery codes exist.

- Retitle the screen **"Drivers & access"**; the sub-route stays under Fleet.
- Change its copy to say **connection code** in full, every time: "Issue a new
  connection code", "Delete this connection code".
- The Fleet-tab key icon keeps its meaning; nothing about driver onboarding moves.

### Wording rules

Break these and the support calls start:

- Driver-facing: always **"connection code"**. Never "your code".
- Customer-facing: always **"delivery code"**. Never "OTP", never "PIN" — those
  read as banking and invite phishing comparisons.
- **The bare word "code" never appears alone** in any admin heading, button,
  tab or toast. It is always qualified.

### Schema rules

**Leave the existing names alone.** `devices.connection_code` and
`driver_connections.connection_code` are correctly named. `drivers.admin_code`,
`tasks.admin_code`, `stations.admin_code` and the rest are *badly* named — they
hold a connection code, not an admin's code — but that name appears 139 times in
`src/` plus RPCs, RLS policies, two edge functions and the offline queue
payloads. Renaming is a multi-day change with a real chance of breaking
tracking. **Do not rename it. Do not add any more of them.**

The new table avoids the collision by construction:

```sql
create table public.delivery_codes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,

  -- The 6 digits the customer tells the driver. NEVER stored in plaintext.
  delivery_code_hash text not null,
  delivery_code_salt text not null,

  -- The long unguessable token in the customer page URL.
  -- This is NOT the code, and must never be shown as one.
  customer_token text not null unique,

  customer_name  text,
  customer_phone text,
  customer_email text,
  sent_via text[] not null default '{}',   -- whatsapp | sms | email

  valid_from timestamptz,                  -- set when the driver goes en route
  expires_at timestamptz not null,

  status text not null default 'issued'
    check (status in ('issued','viewed','redeemed','rejected','refused','expired')),

  redeemed_at         timestamptz,
  redeemed_lat        double precision,
  redeemed_lng        double precision,
  redeemed_distance_m int,                 -- from the drop-off; the dispute-winning number

  attempts     int not null default 0,
  locked_until timestamptz,

  created_at timestamptz default now()
);
```

Three deliberate choices:

1. **No column named `code`.** Anything holding the secret is
   `delivery_code_hash`. Anything holding the URL token is `customer_token`.
2. **No `admin_code` column.** Tenancy is reached through
   `task_id → tasks.admin_code`, so there is exactly one source of truth and
   this table cannot drift out of sync with the fleet it belongs to.
3. **The grep test.** Searching `connection_code` must never return a row of
   this table, and searching `delivery_code` must never return a fleet table.
   If a future column breaks that test, it is named wrong.

---

## 5. What already exists

The data model was designed for this and abandoned:

| Column | Table | Status |
| --- | --- | --- |
| `otp_hash`, `otp_expires_at` | `tasks` | exist, **unused** |
| `verified_by` allows `'otp'` | `task_reports` | already permitted |
| `otp_verified_at` | `task_reports` | exists, unused |
| `latitude`, `longitude`, `distance_to_dropoff_m` | `task_reports` | already written on every delivery |

I would **not** simply reuse `tasks.otp_hash`. A single hash column cannot carry
channels, attempt counts, lockouts, the rejection photos, or the redemption
position. A `delivery_codes` table alongside it is the right shape. But the
groundwork means the driver and owner screens have somewhere to put their data
on day one.

---

## 6. On rebranding — my recommendation is don't

You asked whether to rebrand the whole driver app. I would not, for three
reasons:

1. **You have Play Store production approval right now, unreleased.** Changing
   app identity restarts review, and a package-name change is a *new listing* —
   you lose the approval, the testers, and any reviews.
2. **Tracking is still the product.** The code feature needs tracking to be
   worth more than a text message; the geofenced redemption is the differentiator.
   Burying tracking hides your advantage.
3. **The confusion you are trying to fix is a copy problem, not a name problem.**

Instead:

- **Name the feature, not the company.** Call it **Delivery Code**. Nigerians map
  that to the bank OTP they already understand, with no explanation.
- **Rewrite the store listing**, not the app. The listing is where "for small
  businesses who send goods" belongs.
- If you later want a genuinely separate market, the right move is a **second
  Play listing sharing one backend** — not a rebrand of the first.

---

## 7. What I would build, in order

**Before writing code — validate the price.** Put the §3.2 customer page up as a
static mock-up, show it to ten business owners who currently use GIG, and ask
for ₦3,000. Their answers are worth more than any part of this document. The
whole feature is three weeks; this test is a day.

Then:

- **v1 (~1.5 weeks)** — code generation, the customer page, in-app driver gate,
  receipt lock, WhatsApp click-to-chat + email. No SMS, no rejection flow.
  This is enough to sell.
- **v2 (~1 week)** — rejection-with-photo, the "pressured" alert, SMS with a
  registered sender ID, the driver web-link path for riders without the app.
- **v3** — offline verification via shipped hash, redemption-distance flags,
  driver behaviour patterns. Escrow is **not** on this list and should not be
  until a licensed partner is signed.

---

## 8. Open questions for the owner

1. Is the delivery person always someone you control, or sometimes a random
   okada rider? This decides whether §2.D (driver web link) is v1 or v2.
2. Is ₦3,000/month per business, or per driver? It changes the whole unit
   economics of the SMS quota.
3. What happens to a job whose code expires undelivered — auto-fail, or does
   the owner reissue? I would reissue, but it is a policy decision.
4. Do you want the code visible to the owner after sending? Convenient for
   phone support; it also means a dishonest owner's staff can complete jobs
   without the customer.
