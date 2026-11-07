# Israel Market Research: Used Cars and Taxi Licences

Prepared 2026-11-07
For: Elias, owner of a business that owns taxi licences and taxi cars (leased to drivers) and also buys and sells used cars.

**A note on confidence.** The official gov.il pages blocked automated fetching (they returned errors), so many figures here come from the law texts themselves, the State Comptroller (מבקר המדינה), news outlets, law-firm sites and commercial sites. Items marked **[unverified]** or **[conflict]** should be checked with the Ministry of Transport (משרד התחבורה) or the Taxi Division (אגף מוניות) before anyone hard-codes them into the system. Section 13 lists the open questions. Source numbers in square brackets, for example [S1], point to the sources list at the end.

---

## 1. Executive summary

- **The used-car market is large and flat.** There were 1,316,302 used-car ownership transfers in 2025, up only 1.7% on 2024 (1,293,862) [S2]. The first half of 2025 was flat [S3]. Volume is stable, so the money is in margin per deal, not growth.
- **Used prices are drifting down.** The Tax Authority says the used-price index fell 7.5% between April 2023 and June 2025, while new-car prices rose 6.1% [S4]. 2026 is described as a "buyers' market" [S5]. Inventory held too long loses value, so the system should show stock age.
- **A dealer must follow strict paperwork rules.** A disclosure form (טופס גילוי נאות) must be signed before the contract. The buyer must be registered within 6 working days. Fines can reach about ILS 204,400 and courts often cancel the sale and award damages [S6, S7].
- **Dealer registration is limited to 12 months.** Since January 2023, a car can be registered in the dealer's name (רכב בבעלות סוחר) for only 12 months. After that the dealer counts as an extra "hand" (יד) [S8]. The system needs an alert before the limit.
- **Used-car VAT is charged on the margin, per car.** VAT is 18% of the sale price minus the purchase price, car by car. A negative margin is zero VAT. There is an exception for cars bought from a business that deducted VAT [S9].
- **Israel Invoice (חשבונית ישראל) thresholds are falling.** The allocation-number threshold drops to ILS 5,000 from 1 June 2026 for tax invoices to VAT-registered buyers [S10, S11]. Whether this applies to a margin invoice is unclear (ask the accountant).
- **A taxi licence ("מספר ירוק") is cheaper on the market than from the state.** The state fee is ILS 280,537 (from 1 April 2025) [S12]. Secondary-market prices in 2025 and 2026 are roughly ILS 180,000 to 260,000 and slightly falling [S13, S12].
- **Leasing a licence number brings in about ILS 1,100 to 1,600 a month.** That is a yield of about 6 to 8% a year, against 15 to 25% a decade ago [S12]. Leasing a car plus number is about ILS 1,530 to 1,600 a week in the examples found [S14]. The ILS 1,530 Skoda promo figure is **[source not captured]**.
- **Licence leasing is legal but unregulated.** The State Comptroller found that nobody supervises it [S15]. Protection comes from your own contract, deposit receipts, handover photos and fines-reassignment discipline.
- **Several taxi dates drive the work.** There is an annual operating-licence payment each December, semi-annual tests from vehicle year 10, a hard stop at year 12, a sealed meter, driver licence class D1 with medical checks, and an all-white body rule [S15, S16, S17, S18, S19].
- **Nobody sells software for both halves of the business.** Car-dealer systems and taxi-lease systems exist separately. None combines licence leasing and car dealing.

---

## 2. The used-car market in Israel

### 2.1 Size and trend

| Year | Used-car ownership transfers | Source |
|---|---|---|
| 2023 | 1,121,322 | [S2] |
| 2024 | 1,293,862 | [S2] |
| 2025 | 1,316,302 (+1.7%) | [S2] |

(Figures from Ministry of Transport data, reported by Calcalist on 20.01.2026.)

- First half of 2025: 636,971 transfers versus 638,760 a year earlier, which is flat (Calcalist, 15.07.2025) [S3].
- Used electric cars: 51,778 transfers in 2025 versus 32,814 in 2024 [S2].
- 64,342 transfers in 2025 were of model-year-2025 cars, mostly "0-km" cars pushed out by importers and leasing companies [S2].
- Online share of transfers: 42% in 2024 and about 61% in 2026. This comes from Israel Hayom via a search result. The article could not be fetched, so it is **[unverified]**.
- Full-year 2026 transfer data was not found.

### 2.2 Deal size

- Average deal about ILS 106,000 (July to August 2025, +3% year on year). Financed deals were up 10%, and financing covered more than 80% of deal value. Top-demand cars by average price: Corolla about 102,000, Tucson about 93,000, Ioniq about 88,000, Octavia about 78,000. The data is from Menora's "Mimun BeClick" (Globes, 28.08.2025) [S1].

### 2.3 Prices

- Tax Authority review (October 2026): the used-car price index fell 7.5% from April 2023 to June 2025, while new-car prices rose 6.1% and the consumer price index rose 8.9%. Used index 89.3 (January to July 2026, 2008 = 100) versus 123.3 for new. In the first half of 2026 new-car prices were flat or slightly down because the shekel was strong [S4].
- Chinese used electric cars lost 10 to 16% of value in the first half of 2025, while Tesla held its value (Calcalist, 08.07.2025) [S20].
- 2026 is called a "buyers' market". The new-car average list price is about ILS 170,000 to 180,000, versus about ILS 200,000 in April 2024. There are 52 or more brands and heavy discounting on 0-km cars (Globes/N12, 02.12.2025) [S5].

### 2.4 Supply side and the EV effect

- 2025: imports 251,000 (down 25%); registrations 291,700 (a record, up 8.4%). Electric plus hybrid cars were about 60% of registrations. China supplied 88% of EV imports and 96% of plug-in hybrid imports. Purchase tax on EVs is 45% (52% in 2026) [S4].
- Effect for a dealer: the flood of Chinese EVs and 0-km discounting pushes down the used price of EVs and of nearly-new cars. Residual values differ strongly by brand, so the system should record brand, powertrain and days in stock.

### 2.5 Import of used cars

- Used-car import is negligible: personal import about 600 units, small importers about 3,300 and parallel import about 6,700 (same Tax Authority report) [S4].

---

## 3. Operating as a used-car dealer

### 3.1 Licence

The governing law is the Law on Licensing of Services and Professions in the Vehicle Sector, 2016 (חוק רישוי שירותים ומקצועות בענף הרכב) [S21].

- Two licences exist: "dealer in importer vehicles" (section 89; an equity certificate of ILS 500,000 for up to 150 cars a year, ILS 1.5 million above that) and "dealer in non-importer vehicles" (section 92). A used-car lot normally needs the second.
- Requirements for the non-importer licence: an Israeli-resident individual with a registered business, or an Israeli company; suitable premises with parking; and no disqualifying record (section 8).
- The licence lasts up to 6 years (section 7) with an annual fee. Apply at the district licensing office through gov.il [S22]. That page blocks automated fetching.
- Fees (Ministry of Transport schedule, effective 01.04.2026): non-importer dealer licence ILS 1,676 a year; importer-sourced ILS 2,035; test plate (שלט במבחן) ILS 1,493 [S23].

### 3.2 Dealer duties

From sections 82, 84, 86, 87, 93, 94 and 81 of the 2016 law [S21]:

- Describe the car fully and accurately, and report all damage, including damage that was repaired, before handover.
- Register the buyer as owner within **6 working days** (section 93(b)).
- Use a **written contract** with specifications, price, delivery and warranty terms (section 84).
- Give the warranty in Hebrew (section 86).
- Sign with your name and licence number (section 94).
- **Deposit cap**: 20% of the price on cars above ILS 59,610, unless there is a bank guarantee (section 81).

### 3.3 The disclosure form

Under the Used Vehicle Sale Law, 2008 (חוק מכירת רכב משומש), section 4, a separate document must be given **before the contract**, and the buyer countersigns it. It states [S6, S7]:

- the dealer's identity and the registered owner's identity;
- the number of hands, and the leasing company if any;
- known damage and known kilometres;
- the price.

The dealer must also declare their dealer status. **Anyone selling a car that is not registered in their own name is presumed to be a dealer (section 4(d)).** This matters for consignment sales. The fine can reach about ILS 204,400, and courts routinely cancel such sales and add damages [S6, S7].

### 3.4 Administrative fines

Sections 195 to 203, indexed to the consumer price index. The base amount is ILS 119,460 for an individual non-importer dealer (double for a company). The fine is a percentage of the base [S21]:

| Offence | Share of base |
|---|---|
| Trading without a licence | 100% |
| Inaccurate description | 50% |
| Not reporting damage, no warranty certificate, or not registering the buyer | 5% |
| Repeat offence within 2 years | +50% |

### 3.5 Consumer protection

- There is **no general 14-day cooling-off** period for a used car bought at a lot. The 14 days apply only to distance sales (cancellation fee 5% or ILS 100), and to a new car from an importer that is not yet registered [S24, S25].
- There is no statutory minimum warranty on used cars; the dealer chooses what to offer [S24, S25]. A written warranty is still required (section 86).

### 3.6 Bookkeeping

Income Tax regulations (Addendum 10) require a per-vehicle **trade book (ספר סחר)**: purchase date, seller, price, brokerage and repairs; sale date, buyer, invoice and amount. There is also a **brokerage book (ספר תיווך)**. Double-entry bookkeeping is required above ILS 11.4 million turnover [S6].

---

## 4. Ownership transfer: process and fees

- **Channels:** online at gov.il (both parties authenticate in the same session, the car has no lien or attachment, and the vehicle licence is valid) or through Israel Post. A branch visit is required for power of attorney, personal import, taxis, disabled tags and consecutive transfers (mcars, January 2026) [S26].
- **Fees (01.04.2026):** motor vehicle ILS 257; **ILS 43 when registered to a licensed dealer**; motorcycle ILS 87 [S23]. Third-party sites quote about ILS 235 online. That is uncertain, so verify.
- **Dealer registration (רכב בבעלות סוחר):** no extra "hand" is recorded, the fee is reduced, transfer into dealer ownership is allowed without a valid test, and the licensing fee is refunded pro rata for unsold months [S8].
- **12-month limit:** since January 2023, dealer registration is limited to 12 months. After that the dealer appears as a hand (Calcalist, 21.11.2022) [S27].
- **Test plates:** usable 07:00 to 20:00, only by the holder or employees.
- **Vehicle book:** the dealer must keep a book with entry date, sale and buyer.

---

## 5. Tax

### 5.1 VAT margin scheme (מע"מ על הפרש)

Under VAT Regulation 2 and section 5(a) of the VAT regulations, a dealer whose business is used cars pays 18% VAT on the **margin** (sale minus purchase) per vehicle. The invoice to the buyer shows the margin only. If the margin is negative, VAT is zero, but the invoice still shows the full consideration. **Exception:** if the car was bought from a business that deducted input VAT, VAT is due on the full price. Brokerage: VAT is due on the commission (Tax Authority interpretation 1/2020, 18.05.2020) [S9].

**Worked example.** You buy a car from a private person for ILS 60,000 and sell it for ILS 70,000.

- Margin = 70,000 - 60,000 = 10,000.
- VAT is included in the margin, so VAT = 10,000 x 18/118 = **ILS 1,525.42**.
- If you sold it for ILS 55,000, the margin is negative (-5,000), so VAT = **0**. You still issue an invoice for the full 55,000.
- If you had bought the same car from a VAT-registered business that deducted input VAT, VAT would be due on the full sale price, not the margin.

**Aggregation ruling:** the Trade Mobile ruling (Tel Aviv District Court) allowed monthly aggregation of gains and losses, but losses do not carry forward (Globes, 30.09.2025) [S28].

### 5.2 Purchase tax

Purchase tax (מס קנייה) is paid once, at import, and is not charged on domestic resale. For personal import it is 83% on a petrol base and 45% for EVs in 2025 (mcars) [S29].

### 5.3 Israel Invoice

Allocation-number thresholds, for tax invoices to VAT-registered buyers only (consumer sales are exempt) [S10, S11]:

| Date | Threshold (ILS) |
|---|---|
| May 2024 | 25,000 |
| 2025 | 20,000 |
| 1 January 2026 | 10,000 |
| 1 June 2026 | 5,000 |

This affects sales to businesses and purchases from leasing companies. **Unclear:** whether the threshold is measured on the margin-invoice amount or on the full sale price. Ask the accountant.

---

## 6. Pricing references, marketplaces, financing, insurance and practice

### 6.1 Pricing references

- **Levi Yitzhak (לוי יצחק):** monthly price guide. Print subscription ILS 840 a year including VAT; free app; online via WinWin; an "agent login" portal. No public API found [S30]. Yad2 also publishes its own price list.

### 6.2 Marketplaces

- **Yad2:** dealer ads are paid only, packages cannot be shared, prices are not public [S31]. A "vehicle hunter" dealer alert programme costs "several thousand ILS a year" with a 1-hour head start (Mako, 25.07.2025) [S32]. No public listing API found.
- **Carwiz:** owned by Mimun Yashir (ILS 30 million investment); dealers must hold a trade licence [S33]. **Autoboom:** a Haifa startup (2021). Dealer fees for both are not public.

### 6.3 Financing partners

Mimun Yashir (claims more than 1,000 partner lots), Pama, Max, Cal, and banks (used-car loan-to-value about 70 to 75%).

### 6.4 Insurance for inventory

- Compulsory insurance (ביטוח חובה) must stay in force if a car may be driven.
- A dealer trade policy (ביטוח סחר, for example Harel) covers driving on trade plates, **not parked stock**.
- A separate lot-inventory policy is needed for theft and fire.
- Test status: a car can enter dealer registration without a valid test and be taken to test under the dealer's name. The 2022 amendment removed the test-plate exemption from testing but waives the test fee. This was reported as planned, so **verify the current status**.

### 6.5 Trade-in valuation practice

The Levi Yitzhak list is adjusted for year, kilometres (the Israeli average is about 16,000 a year), hands, condition and demand. The dealer bids below list; the commonly cited gap is 5 to 15%, from low-authority sources [S34].

### 6.6 Consignment practice

The owner keeps title and insurance unless the agreement says otherwise. The agreement should set price, commission, period, liability for damage, theft and fines, test-drive limits, and the dealer's proof of insurance [S35, S36]. The dealer owes the disclosure duties anyway (section 4(d)).

### 6.7 Margins

There is no reliable 2025 data. A training site estimates ILS 3,000 to 10,000 per deal for a starter and ILS 5,000 to 15,000 for a mid-size dealer (mototap, 18.01.2025) [S37]. Treat this as anecdotal.

---

## 7. The taxi licence ("מספר ירוק") market

### 7.1 State fee history (new licence, CPI-indexed, section 14ה of the Traffic Ordinance)

| Date | Fee (ILS) | Source |
|---|---|---|
| 1998 (statute) | 205,000 | statute |
| 2014 | 245,703 | [S38] |
| 2021 (draft bill) | 245,575 | [S39] |
| 1 July 2024 | 275,620 (NTA decision, 3 Jul 2024) | [S40] |
| 1 April 2025 | 280,537 (not raised in April 2026) | [S12] |

An application fee of ILS 735 is quoted by d.co.il (undated) [S41]. Another page quotes about ILS 280,500 for 2025 [S38].

### 7.2 Secondary-market prices (below the state fee since 2009)

| Date | Price (ILS) | Source |
|---|---|---|
| Jan 2017 | 140,000 to 180,000 | [S42] |
| May 2021 | 170,000 to 200,000 + VAT | [S43] |
| Dec 2025 | 180,000 to 220,000 | [S13] |
| Apr 2026 | 200,000 to 260,000; central Israel 220,000 to 250,000; "slight downward trend"; yield 6 to 8% a year vs 15 to 25% a decade ago | [S12] |
| 7 Nov 2026 (live ads) | Haifa 180,000 to 185,000; Be'er Sheva 210,000 + VAT | [S44] |

**[conflict]** TaxiHat quotes ILS 250,000 to 400,000 (May and July 2026), which is inconsistent with every listing seen.

### 7.3 Supply-side reforms

- Quotas were abolished in January 1998 (Wikipedia) **[source not captured]**.
- 25,050 licences at end-2023 versus 24,552 at end-2019 (State Comptroller, November 2024) [S15].
- Service-taxi (monit sherut) reform: holders of line licences (as of 11 August 2016) can buy a taxi licence for ILS 60,000, and unlicensed line drivers at 50%. Regulations in force 1 August 2022 [S45].
- 500 EV licences at 50% were proposed in 2021 and re-approved as a government draft in 2025. No Knesset passage was found [S46]. EV-taxi discount messaging: [S47].

### 7.4 Lease rates and terms

**Number only, monthly:**

| Date | Rate (ILS/month) | Source |
|---|---|---|
| 2017 | 1,000 to 1,800 | [S42] |
| 2021 | about 1,000 + VAT in COVID, up to about 1,500 + VAT normally | [S43] |
| Dec 2025 | 1,300 to 1,600 | [S13] |
| Apr 2026 | 1,100 to 1,500; contracts 12 to 36 months | [S12] |
| Nov 2026 (live ads) | 1,300 and 1,350 incl. VAT; lessor picks a 1, 2 or 3-year minimum | [S44] |

**Car plus number:**

- Weekly "fix" of ILS 1,600 for a 2014 Kia Ceed (texi-rent, undated) [S14].
- ILS 1,530 a week promo for a Skoda Octavia requiring Gett registration (search result, undated) **[source not captured]**.
- The operator pays insurance, servicing and test. Wear is not charged to the driver. The driver may sublet at weekends (texi-rent, ymtaxi) [S14, S43].
- Private owners sometimes charge rent plus a profit share (mnews) [S48].

**Deposits:**

- One job ad demands ILS 5,000 cash as an accident deductible (moniot.org.il, undated) [S49].
- TaxiHat (15 July 2026): a deposit is common for contractor drivers if the contract states the amount and return terms and a receipt is issued. For salaried drivers, section 25 of the Wage Protection Law restricts deposits [S50].

**Early exit and shifts:**

- Early-exit penalty of 1 to 2 months' rent (ymtaxi) [S43].
- A 12-hour night shift runs 20:00 to 08:00, 6 days a week (from an ad). Owners split a car between two drivers by hours.
- Mileage caps: not found in any source.

### 7.5 Reforms and the pending "Uber law"

- August 2025: regulations let ordinary taxis carry students [S51].
- The "Uber law": committee approval 24 February 2026, first reading 24 March 2026. It provides an app registrar, 5-year app licences, drivers with 4 years' experience, cars up to 8 years old, and a compensation fund for holders who return licences, funded per ride [S52]. The Treasury floated about ILS 200,000 per number (ynet) [S53]. It stalled before the 27 October 2026 election over compensation [S54].
- Gett (owned by Pango since May 2024) holds about 70% of app rides, per Yango's December 2025 antitrust complaint. Yango reportedly exited Israel in 2025 via franchisees (Wikipedia) **[unverified]** [S55].
- Business meaning: if the law passes with compensation, the value of the licence you hold could change. Track it, but do not model a figure.

---

## 8. Taxi regulation to track

### 8.1 Who may hold a licence

An Israeli resident (individual or company), no disqualifying conviction, no security objection, and the fee paid. The application is made in person, applicant aged 18 or over, to the Taxi Committee at the Supervisor's office in Jerusalem (Traffic Ordinance sections 13א to 14ו) [S56, S57].

### 8.2 Leasing the licence

- Leasing is legal and needs no ministry approval (law-firm sources, 2024).
- The State Comptroller (November 2024) found that the National Public Transport Authority (NTA) does not supervise licence leasing at all. A holder could lease to someone who fails the section 14 conditions [S15].
- No official lease form exists. TaxiHat's claim that the driver's details must be "updated on the permit" is **[unverified]**.

### 8.3 What is regulated on the vehicle

- A vehicle registered as a taxi must declare the operating-licence number (regulation 276ה).
- Changing the licence on a vehicle needs a prescribed form with the holder's consent (regulation 287ב) [S16].
- Taxi plates end in 25 or 26 [S58].

### 8.4 Annual operating licence (רישיון הסעה במונית)

A payment slip is sent each **December**; paying it is the renewal [S17]. The amount is not confirmed. The vehicle licensing fee for taxis is ILS 138 (petrol) or ILS 648 (diesel) for up to 4 seats (d.co.il, undated) [S59], **[unverified year]**.

### 8.5 Vehicle age

- Regulation 281(א)(2): no licence is issued or renewed 12 years after the manufacture year. This is a **hard stop**.
- Regulation 281(ב): from year 10, the vehicle licence runs for 6 months (semi-annual test), plus a garage certificate (regulation 273(ו)). Brakes are checked every 6 months (273ב) [S16].
- **[conflict]** tim.co.il says "8 years petrol / 10 EV". The 8-year limit is the cap for ride-share cars in the Uber bill, not for taxis [S12].

### 8.6 Tests

Annual until year 10, then semi-annual. Test fee ILS 121.93 (d.co.il) [S59].

### 8.7 Meter

Regulations 509 and 510: an approved, sealed meter in the centre of the dashboard, lab-certified, used on all rides, and resealed when moved to another car. A bill to license meter installers passed first reading on 10 September 2024 [S18]. Fares reset every 1 April [S60].

### 8.8 Driver

Licence class D1, age 21, two years on class B/C1, a course of about 150 hours (ILS 4,000 to 10,000), theory and practical exams, a medical, and police clearance [S61]. D1 renewals need medical checks: every 5 years at ages 60 to 75, every 2 years over 75 [S62].

### 8.9 White colour rule

Ministry of Transport procedure T-01-2020 (updated 18.05.2020), section 4.א.4: the exterior colour must be white [S19]. In July 2026 hundreds of imported cars with white and black roofs were denied a test; the fix is a roof sticker costing ILS 1,650 (N12, 13 July 2026) [S63]. The roof-sign convention (yellow illuminated "מונית / TAXI" box with a number) is confirmed only by encyclopedic sources; the regulation text on sign colour was **not located** [S64].

### 8.10 Insurance costs (2026)

- Compulsory (חובה): ILS 8,900 to 13,500.
- Third party (צד ג'): ILS 2,400 to 4,700.
- Comprehensive (מקיף): ILS 9,900 to 18,500 (container.org.il, 2026, undated) [S65].
- All-in: ILS 18,000 to 30,000 a year (tim.co.il, April 2026) [S12].
- Comprehensive cover must carry a taxi/business extension.

### 8.11 Licence transfer process

Application, then Taxi Committee, then a written permit. The transfer-permit fee is ILS 2,294 (Wikisource schedule; older copies show ILS 1,945 to 1,957) **[unverified]**. Inheritance transfer costs ILS 752 to 882. Transferring the vehicle is a separate step at the licensing office. Hold funds in trust until approval, and check liens and debts (TaxiHat, 8 July 2026) [S66]. Lawyer fees are not published.

---

## 9. Risks and protections

- **Fines (דוחות):** section 27ב presumes the registered owner was the driver. Reassigning a fine (הסבת דו"ח) needs the driver's affidavit within about **90 days** [S67]. The system must track the deadline for each fine.
- **Employee reclassification:** the Haifa Labor Court (November 2013) ruled that a "self-employed" station driver was an employee, awarding about ILS 63,400 in benefits. Fixed rosters, owner-set fares and owner-supplied cars were decisive (ynet) [S68]. A car-plus-number lease with owner-set conditions is exposed to the same argument.
- **Unpaid rent and registration failures:** Jerusalem Magistrates 3187-09 (26 March 2012): heirs counter-claimed ILS 1,500 x 56 months (ILS 84,000). Unsigned transfer papers left the taxi on a temporary licence (psakdin) [S69].
- **Protections cited** (TaxiHat, July 2026): a written contract with deposit and return terms and a receipt; a promissory note; timestamped handover photos and a signed checklist; ministry approval before money changes hands; verifying the driver's D1 and the policy extension [S50].
- **GPS tracking:** no taxi-specific source was found. Insurers often require Ituran for comprehensive cover (general, not taxi-specific).

---

## 10. Competing software and the gap

### 10.1 Car-dealer systems

| Product | What it does | Price |
|---|---|---|
| EasyList (איזיליסט, since 2015) | Inventory, deals, tax invoices and receipts, sale/purchase/brokerage/disclosure forms with e-signature, CRM, cash flow, catalogue site, dealer-to-dealer marketplace, Israel Invoice module, accounting export, mobile apps. Tax Authority software no. 210001. No yad2 sync or Levi Yitzhak integration advertised. [S70] | ILS 299 / 399 / 499 / 799 per month (30 / 60 / 120 / unlimited cars) |
| DealerX | AI-flavoured CRM: plate lookup, Facebook/Instagram leads, WhatsApp, deals and documents with remote signing, own marketplace, "price list" tool, accountant folder. No yad2 sync, no invoicing stated. [S71] | ILS 1,490/month (annual) or 1,990 (monthly), ex VAT |
| Tafnit (Matrix), AlmogERP | Target importers and leasing companies, not small lots | not found |

**Gaps across vendors:** no yad2 publishing API, no Levi Yitzhak feed, and consignment and trade-in-margin VAT logic are not advertised.

### 10.2 Accounting APIs the system could connect to

- Morning/Green Invoice: REST, token from API key (1 hour), documents/clients/expenses/payments/webhooks, sandbox, MCP "soon" [S72].
- iCount: API v3 with token auth, document create/cancel (unofficial client; official docs not reachable) [S73].
- EZcount: REST, demo and production keys [S74].
- Rivhit: API for Rivhit Online [S75].

### 10.3 Taxi systems

| Product | What it does | Price |
|---|---|---|
| TaxiHat (Tel Aviv) | Digital contracts with e-signature/WhatsApp, driver and vehicle records, payment tracking and arrears alerts, ministry forms, "Nudnik" reminders [S76] | ILS 200 / 300 / 450 per month by contract volume; add-ons ILS 50 to 100; 45-day trial (Nov 2026) |
| Minisoft "מודול מוניות" | Station dispatch, vouchers, driver billing, cheque printing with withholding, accounting link [S77] | not public |
| NTM (Bat Yam) | Vouchers, customers, driver price lists [S78] | not public |
| Drive Me, RideUp, Dogma (white-label), Moran Access-based tool | Dispatch/driver apps; Drive Me charges drivers a subscription | none publish pricing |

None targets number-owners' lease ledgers except TaxiHat.

### 10.4 The gap

Nobody combines licence leasing and car dealing. Dealer systems have no taxi-licence ledger, regulation alerts or fines reassignment. Taxi systems have no stock, trade-in, consignment or margin-VAT logic. A single system covering both is the gap this project fills.

---

## 11. What this means for the system

| Regulation or practice | Feature that handles it |
|---|---|
| Disclosure form must be signed before the contract (Used Vehicle Sale Law s.4) | **Gate on sales:** a deal cannot be finalised until the disclosure form is generated and countersigned. For consignment cars, include the dealer-status declaration (s.4(d)). |
| Buyer registered within 6 working days (s.93(b)) | **Transfer due date** on every sale, with a reminder and an overdue flag. |
| Dealer registration limited to 12 months | **11-month alert** per car in dealer ownership, before the car becomes an extra hand. |
| Per-vehicle trade book and brokerage book | **Trade-book export** per vehicle (purchase date, seller, price, brokerage, repairs; sale date, buyer, invoice, amount). |
| VAT on margin per car, zero if negative, exception for purchase from a VAT business | **Margin VAT calculated per deal**, with a field for seller type (private or VAT business). Show the formula (margin x 18/118). |
| Israel Invoice allocation numbers (threshold falling to ILS 5,000) | Flag business-buyer invoices above the current threshold; keep the threshold as a setting, pending the accountant's answer. (suggested) |
| Written contract, Hebrew warranty, deposit cap 20% above ILS 59,610 | Contract templates; a warning when a deposit exceeds the cap; deposit receipts. |
| Taxi cars: semi-annual tests from year 10, hard stop at year 12 | **Taxi 10-year and 12-year alerts** per vehicle, plus test and garage-certificate dates. |
| Annual operating-licence payment each December | **December licence-fee reminder** per licence number. |
| Sealed meter, resealed when moved to another car | **Meter seal fields** per vehicle (seal date, calibration, car it is in). |
| Driver class D1 and medical validity | **D1 and medical expiry dates** per driver, with alerts. |
| Fines presumed on the owner; reassignment within about 90 days | **Fines register** with a reassignment deadline, driver affidavit status and amount. |
| Deposits are common but need written terms and a receipt | **Deposit receipts** and a return-terms record on each lease. |
| Timestamped handover photos and signed checklist | **Handover checklist** with photos, signed by both sides. |
| Which vehicle each licence number is attached to (regs 276ה, 287ב) | Licence-to-vehicle register with a history of reassignments and the consent form. (suggested) |
| Inventory not covered by trade policy; compulsory insurance must stay in force | **Business-level insurance policies** (compulsory, trade, lot inventory, comprehensive with taxi extension) with expiry dates, linked to cars. |
| Licence leasing is unregulated; reclassification risk | Lease contract storage, payment tracking, arrears alerts, and a note of who sets fares and rosters. |
| Consignment: owner keeps title and insurance | Consignment agreement record (price, commission, period, liabilities, proof of insurance). |
| White-body rule for taxis | A body-colour field on taxi cars, checked when a car is added. (suggested) |

---

## 12. Open items to confirm

Confirm these with your accountant or the Ministry of Transport before hard-coding anything:

1. **Margin-VAT and Israel Invoice:** is the allocation-number threshold measured on the margin-invoice amount or on the full sale price? (Accountant.)
2. **Transfer-permit fee** for a taxi licence: ILS 2,294 or an older figure (1,945 to 1,957)? (Taxi Division.)
3. **Test-plate testing status:** did the 2022 amendment take effect (testing required, fee waived)? (Ministry of Transport.)
4. **Roof-sign colour rule:** the regulation text was not located. (Ministry of Transport.)
5. **Annual operating-licence amount** (the December payment) and the year of the vehicle-licence fees of ILS 138 and ILS 648.
6. Whether driver details must be updated on the operating licence when leasing (TaxiHat claim, unverified).
7. The correct secondary-market price level, given the conflict between TaxiHat and other listings.
8. Current online fee for ownership transfer: ILS 257 (official schedule) or about ILS 235 (third-party sites).
9. Status of the "Uber law" after the 27 October 2026 election.

Not found anywhere: yad2/Autoboom/Carwiz dealer package prices, Levi Yitzhak API or business terms, official iCount docs, authoritative dealer margin statistics, full-year 2026 transfer data, and mileage caps in taxi lease contracts.

---

## 13. Sources

Dates are the dates given in the research briefs (research as of 7 Nov 2026). Numbers are in order of first citation in the text.

- S1. Globes, 28.08.2025: https://www.globes.co.il/news/article.aspx?did=1001520179
- S2. Calcalist, 20.01.2026: https://www.calcalist.co.il/local_news/car/article/sjwlh3hhzg
- S3. Calcalist, 15.07.2025: https://www.calcalist.co.il/local_news/car/article/bypctuqlxx
- S4. Tax Authority vehicle review 2025 (Oct 2026), gov.il PDF: https://www.gov.il/BlobFolder/reports/tax-reviewvehicle/he/Publications_VehicleReview_vehicle2025-1.pdf
- S5. Globes/N12, 02.12.2025: https://www.mako.co.il/news-money/2025_q4/Article-ebad8e4de5eda91027.htm
- S6. dmv.co.il (disclosure law, fines, bookkeeping): https://www.dmv.co.il/rd/%D7%94%D7%95%D7%A8%D7%90%D7%95%D7%AA-%D7%97%D7%95%D7%A7-%D7%A1%D7%95%D7%97%D7%A8-%D7%A8%D7%9B%D7%91-%D7%95%D7%9E%D7%95%D7%A1%D7%9B%D7%99%D7%9D
- S7. Blitshtein Law: https://www.blitshtein-law.com/%D7%A2%D7%95%D7%A8%D7%9A-%D7%93%D7%99%D7%9F-%D7%9C%D7%A2%D7%A0%D7%99%D7%99%D7%A0%D7%99-%D7%A8%D7%9B%D7%91/%D7%98%D7%95%D7%A4%D7%A1-%D7%92%D7%99%D7%9C%D7%95%D7%99-%D7%A0%D7%90%D7%95%D7%AA/
- S8. tavsahar.co.il (dealer registration): https://tavsahar.co.il/
- S9. Tax Authority interpretation 1/2020, 18.05.2020: https://www.gov.il/BlobFolder/policy/vat_11/he/parshanot%201-2020.pdf
- S10. Green Invoice, 24.03.2026: https://www.greeninvoice.co.il/magazine/israel-invoice/
- S11. Chamber of Commerce: https://www.chamber.org.il/serviceslobby/finance/1429/162557/
- S12. tim.co.il, updated Apr 2026 (state fee, secondary prices, yields, insurance, vehicle-age conflict): https://www.tim.co.il/כמה-עולה-לקנות-ולהפעיל-מונית-בישראל/
- S13. shraiber, Dec 2025: https://www.shraiber.co.il/how-much-does-a-taxi-driver-earn/
- S14. texi-rent (undated): https://www.texi-rent.co.il/fixed-price-taxi/taxi-rental-fix-price-per-month
- S15. State Comptroller, Nov 2024: https://library.mevaker.gov.il/sites/DigitalLibrary/Documents/2024/2024.11-75A-PartB/2024.11-75A-PartB-205-Taxi-taktzir.pdf
- S16. Wikisource, Traffic Regulations: https://he.wikisource.org/wiki/תקנות_התעבורה
- S17. gov.il taxi licence renewal: https://www.gov.il/he/service/taxi-license-renewal
- S18. ice, meter installers bill, 10 Sep 2024: https://www.ice.co.il/auto/news/article/1029382
- S19. Ministry of Transport procedure T-01-2020, 18.05.2020: https://www.gov.il/BlobFolder/policy/t-01-2020/he/taxi_mandatory_policy.pdf
- S20. Calcalist, 08.07.2025: https://www.calcalist.co.il/local_news/car/article/rjt3prcrlg
- S21. Law on Licensing of Services and Professions in the Vehicle Sector, 2016: https://www.nevo.co.il/law_html/law00/142129.htm
- S22. Dealer licence application (gov.il, blocks automated fetch): https://www.gov.il/he/service/car-dealer-license-application
- S23. Ministry of Transport fee schedule, effective 01.04.2026: https://www.gov.il/BlobFolder/policy/car_fees_2026/he/%D7%93%D7%A3%20%D7%90%D7%92%D7%A8%D7%95%D7%AA%20%2001.04.2026.pdf
- S24. Israel Hayom: https://www.israelhayom.co.il/article/464837
- S25. mcars (cancelling a deal): https://mcars.co.il/blog/bitul-iskat-rechev
- S26. mcars, Jan 2026 (ownership transfer): https://mcars.co.il/blog/haavarat-baalut-rechev-2026
- S27. Calcalist, 21.11.2022 (12-month dealer registration limit): https://www.calcalist.co.il/local_news/car/article/hy3a35uio
- S28. Globes, 30.09.2025 (Trade Mobile ruling): https://www.globes.co.il/news/article.aspx?did=1001522929
- S29. mcars (purchase tax): https://mcars.co.il/blog/mas-kniya-al-rechev-israel-2026
- S30. Levi Yitzhak: https://levi-itzhak.co.il/%D7%A8%D7%9B%D7%91
- S31. Yad2 terms: https://www.2.yad2.co.il/en/eula
- S32. Mako, 25.07.2025 (vehicle hunter): https://www.mako.co.il/news-money/consumer/Article-690e882977d3891027.htm
- S33. Carwiz: https://carwiz.co.il/about
- S34. carpilot (trade-in): https://www.carpilot.co.il/%D7%9E%D7%97%D7%A9%D7%91%D7%95%D7%9F-%D7%98%D7%A8%D7%99%D7%99%D7%93-%D7%90%D7%99%D7%9F-%D7%A8%D7%9B%D7%91/
- S35. hon.co.il (consignment insurance): https://www.hon.co.il/car-left-at-dealer-insurance/
- S36. echud, 04.10.2026: https://echud.co.il/bituach-melai-rechavim-bamigrash/
- S37. mototap, 18.01.2025: https://mototap.co.il/%D7%9B%D7%9E%D7%94-%D7%9E%D7%A8%D7%95%D7%95%D7%97-%D7%A1%D7%95%D7%97%D7%A8-%D7%A8%D7%9B%D7%91/
- S38. he.wikipedia, "מספר ירוק" (2014 fee; 2025 price about ILS 280,500): https://he.wikipedia.org/wiki/מספר_ירוק
- S39. tazkirim.gov.il, 2021 draft bill: https://tazkirim.gov.il/s/legislativeworkactivity/a133Y00000K4O3hQAF/הפצה-להערות-ציבור?language=en_US
- S40. obudget, NTA decision 3 Jul 2024: https://next.obudget.org/i/gov_decisions/ac9eb211-0ee4-4d1a-a758-d18532ae3c82
- S41. d.co.il, application fee (undated): https://www.d.co.il/priceList-24060/
- S42. yad2 magazine, Jan 2017: https://magazine.yad2.co.il/vehicles/מי-פנוי-באיילון/326
- S43. ymtaxi, May 2021: https://ymtaxi.co.il/עולם-המוניות/
- S44. taxi-il, live ads 7 Nov 2026: https://taxi-il.co.il/green-number
- S45. ice, 4 Jul 2022 (service-taxi reform): https://www.ice.co.il/auto/news/article/867523
- S46. obudget (EV licences draft): https://next.obudget.org/i/gov_decisions/5621aee0-b279-4aca-a11a-f73b6e593fbe
- S47. EV-taxi discount messaging (ice): https://www.ice.co.il/auto/news/article/852061
- S48. mnews: https://www.mnews.co.il/עסקיםוקריירה/השכרת-מונית-איך-להיות-נהג-מונית-בתנאים/
- S49. moniot.org.il (undated): https://moniot.org.il/דרושים-נהגים/
- S50. TaxiHat handover protocol, 15 Jul 2026: https://taxihat.co.il/news/taxi-handover-new-driver-protocol-2026
- S51. ice, Aug 2025 (students in taxis): https://www.ice.co.il/auto/news/article/1081377
- S52. ice ("Uber law"): https://www.ice.co.il/auto/news/article/1104098
- S53. ynet (Treasury ILS 200,000 per number): https://www.ynet.co.il/economy/article/s1gsz4urxg
- S54. matzav (stalled before 27 Oct 2026 election): https://matzav.com/major-blow-to-chareidi-drivers-uber-style-ride-sharing-reform-on-verge-of-collapse/
- S55. Wikipedia, Yango Group: https://en.wikipedia.org/wiki/Yango_Group
- S56. kedemadv (Traffic Ordinance): https://www.kedemadv.co.il/פקודת-התעבורה/
- S57. gov.il taxi licence request: https://www.gov.il/he/service/taxi_operation_licence_request
- S58. Plate numbers: https://he.wikipedia.org/wiki/לוחית_רישוי_בישראל and https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Israel
- S59. d.co.il (vehicle licensing fee, test fee; undated): https://www.d.co.il/priceList-34675/
- S60. bus.gov.il taxi calculator: https://bus.gov.il/taxicalculator
- S61. yuvali (driver guide): https://www.yuvali.co.il/blog/taxi-license-guide/
- S62. gov.il driving licence renewal: https://www.gov.il/he/service/driving_license_renewal
- S63. N12, 13 Jul 2026 (white-colour rule): https://www.mako.co.il/news-money/2026_q3/Article-4a8b4bc713b5f91026.htm
- S64. Roof-sign convention (not regulation text): https://en.wikipedia.org/wiki/Taxi_livery
- S65. container.org.il (taxi insurance, 2026, undated): https://www.container.org.il/כמה-עולה-ביטוח-מונית/
- S66. TaxiHat, licence transfer, 8 Jul 2026: https://taxihat.co.il/news/taxi-license-transfer-process-2026
- S67. roadprotect (fines reassignment): https://roadprotect.co.il/guides/transfer-israel-traffic-ticket-another-driver/
- S68. ynet, Haifa Labor Court Nov 2013: https://www.ynet.co.il/article/4454581
- S69. psakdin, Jerusalem Magistrates 3187-09: https://www.psakdin.co.il/Court/פסק-דין-בתיק-תא-3187-09
- S70. EasyList: https://www.easylist.co.il/
- S71. DealerX: https://dealerx.co.il/
- S72. Morning developers: https://developers.morning.co/api
- S73. iCount client (unofficial): https://github.com/qderai/icount-js
- S74. EZcount Postman docs: https://documenter.getpostman.com/view/16363118/TzkyNLWB
- S75. Rivhit API: https://rivhit-api.readme.io/docs/general
- S76. TaxiHat pricing, Nov 2026: https://taxihat.co.il/pricing
- S77. Minisoft taxi module: http://www.minisoft.co.il/תוכנה-לניהול-תחנת-מוניות
- S78. NTM (thetaxi): https://thetaxi.co.il/Supplier-327424/תוכנה-לניהול-תחנת-מוניות-NTM
