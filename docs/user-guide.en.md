# Renawi Motors: User Guide

How to run the taxi-licence leasing and the used-car trading with the Renawi Motors system, day to day.

Hebrew version: [user-guide.he.md](user-guide.he.md)

## Contents

1. [Getting started](#1-getting-started)
2. [Vehicles](#2-vehicles)
3. [Taxi licences](#3-taxi-licences)
4. [Drivers](#4-drivers)
5. [Leases](#5-leases)
6. [Ledger and deposits](#6-ledger-and-deposits)
7. [Traffic fines](#7-traffic-fines)
8. [Deals: purchases, sales, consignment](#8-deals-purchases-sales-consignment)
9. [Reminders and the bell](#9-reminders-and-the-bell)
10. [Contacts and leads](#10-contacts-and-leads)
11. [Dashboard and reports](#11-dashboard-and-reports)
12. [Printable PDFs](#12-printable-pdfs)
13. [Settings](#13-settings)
14. [Backups](#14-backups)
15. [Legal notes](#15-legal-notes)

Button, tab and field names below are written exactly as they appear on screen in English. If you work in Hebrew or Arabic, the same buttons are in the same places, mirrored right to left.

---

## 1. Getting started

### Opening the system

The system is a website. Open the address you were given for the business (it starts with `https://`) in Chrome, Safari or Edge, on a computer or a phone. You need an internet connection: the data lives on the server, not on the device.

### Signing in

1. Enter your **Email** and **Password**.
2. Click **Log in**.

If you see "Invalid email or password", check the spelling (the password is case-sensitive). After several failed attempts the system asks you to wait a few minutes before trying again. If you see "Your session has expired", simply sign in again.

### The screen

- The side menu holds **Dashboard**, **Vehicles**, **Taxi licences**, **Drivers**, **Leases**, **Deals**, **Fines**, **Contacts**, **Reminders**, **Reports** and **Settings**.
- On a phone the menu is hidden: tap the menu button at the top to open it. Lists turn into cards, and on a record page the main action stays as a button while the other actions move into the "more" menu (the three dots).
- The top bar holds the reminders bell, the language menu, the theme switch and your user menu.

### Language

Click the globe icon (**Language**) and choose **עברית**, **العربية** or **English**. The whole screen switches at once, including the direction (right to left for Hebrew and Arabic). Your choice is saved to your account.

### Light and dark theme

Click the moon or sun icon in the top bar (**Switch to dark theme** / **Switch to light theme**). The choice is remembered.

### Installing on the phone home screen

The system can be installed like an app, with its own icon and full screen:

- **iPhone (Safari):** open the site, tap Share, then "Add to Home Screen".
- **Android (Chrome):** open the site, tap the browser menu, then "Install app" or "Add to Home screen".

The installed app is the same website: it still needs internet, and you sign in the same way.

### Changing the password

There is no password-change screen in the app yet. To change the password, ask whoever installed and runs the server.

### Signing out

Click your name or avatar in the top bar (**User menu**), then **Log out**. Always sign out on a computer that other people use.

---

## 2. Vehicles

The **Vehicles** page has two tabs: **Inventory** (all cars: stock, taxis, consignment cars and drivers' own cars) and **Business insurance** (trade and lot policies that cover the business rather than one car).

Use the search box (plate, VIN, make or model) and the filters (status, ownership, **Taxis only**, **Year from** / **Year to**) to find a car.

### Adding a vehicle

1. Go to **Vehicles** and click **New vehicle**.
2. Fill in the sections:
   - **Identification:** **Plate number** (required), **VIN / chassis number**. Plates ending in 25 or 26 are taxi plates; tick **This vehicle is a taxi** for a taxi.
   - **Specifications:** make, model, trim, year, colour, fuel, gearbox, engine, **Hand** (1 = first owner), **Odometer**.
   - **Status and ownership:** **Ownership** is **Owned** (our car), **Consignment** (we sell it for someone else) or **Third party** (for example a driver's own car). For **Third party**, choose the **Owner (driver)**.
   - **Registration:** **Licence / test expiry** and **Dealer registration since**.
   - **Taxi meter:** **Meter serial number** and **Meter sealed on** (taxis).
   - **Location and price:** **Location** (lot, garage or address) and **Listing price**.
3. Click **Save**.

Usually you do not need to add a bought car here: recording a **Purchase** deal (section 8) creates the car for you.

**Dealer registration:** a car registered in the dealer's name may stay that way for up to 12 months. Fill in **Dealer registration since**; the car gets the alert "Dealer registration 11+ months" and a reminder before the limit.

### The vehicle file

Click a car to open its file. The header shows the plate, status, ownership and alerts (for example "Licence expiring" or "Taxi 10+ years old"). The actions are **Edit**, **Change status**, **Take on consignment** / **Return to consignor** (when relevant), **Add expense**, **Add odometer reading**, **Consignment agreement** (for a consignment car) and **Add reminder**.

The tabs:

- **Info:** all details, the **Odometer log** and the **Inventory cycles** (each period the car was in our stock or on consignment).
- **Expenses:** costs recorded for the car.
- **Insurance:** the car's insurance policies.
- **Documents:** scans and photos.
- **Deals:** purchases and sales of this car, with **Record purchase**, **Sell this car** or **Consignment sale** to start a deal.
- **Leases:** the lease contracts this car was on.
- **Fines:** traffic fines for this car.
- **P&L:** revenue, costs and profit per inventory cycle. While the car is unsold the profit is an estimate at the **Listing price** (marked "Unrealised").

**Change status** lets you mark a car in stock as **Reserved** (and back to **In stock**) or **Scrapped**. To mark a car as **Sold**, record a sale deal instead; leasing a taxi and ending its lease change the status by themselves.

### Recording an expense

1. In the car's file click **Add expense**.
2. Choose the **Category** (Repair, Annual test, Insurance, Fuel, Towing, Parts, Cleaning, Fine, Licence fee, Taxi meter, Other), the **Date**, **Vendor / garage** and **Amount**.
3. Choose **Paid by**: **Us**, **Driver** or **Consignor**. Only what we paid counts as our cost.
4. Tick **Amount includes VAT** and **VAT can be reclaimed** when they apply, so the reports show the VAT to reclaim.
5. Click **Save**.

If we paid an expense that the driver should cover (for example a repair after damage), open the **Expenses** tab and use **Rebill to driver** on that row. The driver who had the car on that date is matched automatically; you can pick another driver. The amount is added as a charge in the driver's ledger and the row is tagged "Rebilled".

### Insurance policies

1. Open the **Insurance** tab and click **Add policy**.
2. Fill in **Policy type** (Compulsory, Third party, Comprehensive), **Insurer**, **Policy number**, **Start date**, **End date**, **Premium**, **Paid by**, and tick **Taxi extension** for a taxi with a comprehensive policy.
3. Click **Save**.

Trade (dealer) and lot policies go under **Vehicles** > **Business insurance**. The **End date** of every policy feeds the reminders.

### Odometer readings

Click **Add odometer reading**, enter the **Reading (km)**, the **Date** and the **Source** (for example handover, annual test, service). The car's odometer updates and the reading is added to the **Odometer log**.

### Documents and photos

Every record with a **Documents** tab (car, driver, licence, lease, deal) works the same way:

1. Click the upload area ("Click or drag a file here to upload") or drag a file onto it. Allowed: PDF, JPG, PNG or WebP, up to 20 MB.
2. On a phone, **Take a photo** opens the camera directly.
3. In the **Upload document** window choose the **Document type** (for example Vehicle licence, Insurance policy, Photo), add a **Title** if you like, and an **Expiry date** when the document expires.
4. Click **Upload**.

A document with an expiry date shows a badge ("Valid", "Expiring soon", "Expired") and appears in the reminders before it expires. Click a photo to view it full size; each card also has download, edit and delete buttons.

### Taking a car on consignment

1. Add the car with **Ownership** set to **Consignment** (or open an existing car).
2. Click **Take on consignment**.
3. Fill in the **Consignor** (the owner), **Start date**, **Asking price**, **Minimum net to the consignor**, **Commission type** (**Fixed amount**, **Percentage** or **Surplus over minimum**), the commission and **Agreement ends**.
4. Click **Save**. The car is now in stock as a consignment car.

Print the agreement with the **Consignment agreement** action. If the car does not sell, use **Return to consignor** to end the consignment and give the car back.

---

## 3. Taxi licences

The **Taxi licences** page lists the licences ("green numbers") the business owns, with the current driver, the car, the rent and the annual fee date.

### Adding a licence

1. Click **New licence**.
2. Fill in **Licence number** (as printed on the licence), **Registered holder** and **Status** (**Active**, **Suspended**, **Transfer pending**, **Sold**).
3. Under **Fees and renewal**: **Annual fee due** (filled in with 31 December of this year) and **Renewal date**.
4. Under **Purchase and sale**: **Acquired on** and **Purchase price** (and later **Sold on** and **Sale price**). These are used for the licence P&L.
5. Click **Save**.

### Registering a car on the licence

The licence is registered at the Ministry of Transport on one specific car (with the licence assignment form and a resealed meter). To record which car that is:

1. Open the licence and click **Register vehicle**.
2. Choose the taxi and click **Register**. To remove the car, use **Detach the car**.

Rules the system enforces and watches:

- A taxi aged **12 years or more** cannot be registered on a licence.
- From **year 10** a taxi is on the semi-annual test regime. The car gets the alert "Taxi 10+ years old", and the reminders show the semi-annual test and the approaching 12-year limit.

Upload the signed form to the licence's **Documents** tab with the type "Licence assignment form".

### Annual fee in December

The annual operating fee is paid with the December slip. The licence shows "Annual fee due soon" or "Annual fee overdue", and the reminder appears according to **Settings** > **Reminder timing**. After paying, open the licence, click **Edit** and set **Annual fee due** to next year's date.

### Licence P&L

The **P&L** tab shows the **Total income** from the licence (rent and other income, also **Income by year**) and the **Net result**: income minus the purchase price, plus the sale price once sold. Rent from a "Licence only" lease counts toward the licence; the **Overview** tab shows the **Current assignment** and the **Assignment history**.

---

## 4. Drivers

### Adding a driver

Every driver is also a contact (name, ID number, phones).

1. Go to **Drivers** and click **New driver**.
2. **1. Contact:** choose **Existing contact** and pick the person, or **New contact** and type the details. The "Driver" tag is added automatically.
3. **2. Driver details:** **Driving licence number**, **Driving licence expiry**, **Taxi driver permit number**, **Taxi permit expiry**, **Medical certificate expiry**, **Emergency contact**, **Emergency phone**, **Driving with us since**.
4. Click **Save**.

You can also create a driver profile from a contact page with **Create a driver profile**.

### Expiry dates

The driving licence, taxi permit and medical certificate expiries appear as alerts on the driver ("Taxi permit expiring", "Medical certificate expired" and so on) and in the reminders, by default 60 days ahead. Upload the scans in the driver's **Documents** tab with their expiry dates.

### The driver's own car (licence-only leases)

When a driver leases only the licence, the licence is registered on the driver's own car. To record that car:

1. Go to **Vehicles** > **New vehicle**.
2. Set **Ownership** to **Third party** and choose the driver in **Owner (driver)**.
3. Fill in at least the plate, year and **Licence / test expiry**, and save.

The car then appears on the driver's **Profile** tab under **The driver's own cars** and can be chosen in the lease wizard. Add its insurance in its **Insurance** tab so the expiry is tracked.

### The driver file

The header shows the phone, the **Balance** and the **Active contract**. Actions: **Edit**, **New lease**, **Record payment**, **Add reminder**. Tabs:

- **Profile:** licences and permits, contact details, the driver's own cars.
- **Contracts:** all the driver's lease contracts, with **New lease**.
- **Ledger:** the driver's statement (section 6).
- **Documents:** scans of ID, licence, permit, medical certificate.

In the **Drivers** list, the **Balance** and **Deposit held** columns and the **With a balance only** filter show who owes money.

### Balance and ageing

At the top of the ledger you see the **Balance** ("Owes us", "In credit" or "Settled"), the **Deposit held**, the totals **Charged** and **Paid**, and the **Overdue** breakdown: **Not yet due**, **1–30 days**, **31–60 days**, **61–90 days**, **Over 90 days**. Payments are applied to the oldest open charges first.

---

## 5. Leases

There are two kinds of lease (**Lease type**):

- **Licence only:** the driver puts our licence on their own car.
- **Car + licence:** we lease our taxi together with the licence.

### The new-lease wizard

Go to **Leases** > **New lease** (or **New lease** on a driver or a licence). The wizard has six steps; **Next** checks each step before moving on, and **Back** returns.

1. **Driver:** choose the driver or create a **New driver**. You are warned if the driver already has an active contract.
2. **Licence:** choose an **Available licence**. Only active licences that are not leased are offered.
3. **Car:** choose the **Lease type**. For **Car + licence** choose the **Taxi**; for **Licence only** choose **The driver's own car** or **No car recorded**.
4. **Terms:** **Start date**, **End date** (the last day, inclusive; one year by default), **Monthly rent**, **Payment day of the month** (1 to 28), **Early-exit penalty** (months of rent charged if the driver leaves early), **Rent includes VAT**, **Who pays** (insurance, annual test, repairs, fines: us or the driver; by default the driver pays everything except the car itself) and **Contract terms** for this contract.
5. **Deposit & handover:** **Deposit** amount and **Deposit type** (**Cash**, **Cheque**, **Promissory note**). For **Car + licence**, fill in the **Handover checklist** (km, fuel level, spare wheel, jack, documents in the car, damages, meter sealed, photos taken).
6. **Review:** check everything and click **Create draft**.

### From draft to active

A new contract is a **Draft**: it charges nothing yet. You can still **Edit** or **Delete** it. When the contract is signed and the deposit is received:

1. Open the contract and click **Activate**.
2. Fill in **Signed on**, and under **Deposit received** the amount actually received, the **Payment method**, **Reference** and **Deposit date**. Leave the deposit empty if none was received.
3. Click **Activate**.

The contract becomes **Active**, the first rent is charged from the start date, and the deposit is recorded.

### Monthly rent

- Rent is charged per calendar month. The system creates each month's charge automatically every night; you do not need to enter rent.
- The first and the last month are prorated by days. Example: a contract that starts on the 16th of a 31-day month is charged 16/31 of the rent for that month.
- Each charge is due on the contract's **Payment day of the month**.
- When the driver does not pay on time the contract and the driver show "Overdue rent".

### Recording a payment

1. On the contract (or the driver) click **Record payment**.
2. Enter the **Amount**, **Date**, **Payment method** (Cash, Bank transfer, Cheque, Bit, Credit card), **Reference** (cheque number, transfer or Bit confirmation) and notes.
3. Click **Save**. The balance updates at once.

### Swapping the car or changing the rent

Use **Swap car / change rent**. Choose the date **From** which the change applies, then the new **Monthly rent**, licence or car, and a **Reason**. The current period closes the day before that date and a new one starts. A change in the middle of a month splits that month's rent into two lines. The history is under **Licence, car and rent over time** on the **Overview** tab.

### Editing an active contract

**Edit** on an active contract changes only the end date, payment day, terms, responsibilities and notes. Rent and car changes go through **Swap car / change rent**.

### Ending a contract

1. Click **End contract**.
2. Fill in the **Actual end date** and the **End reason** (Expired, Terminated by us, Terminated by the driver, Other).
3. If the contract ends before its end date, rent already charged for later days is credited back automatically. Tick **Charge the penalty** to add the early-exit penalty (months × monthly rent).
4. Decide what to do with the **Deposit**: **Keep**, **Return to the driver** or **Apply to the debt**.
5. For a car lease, fill in the **Return checklist** (km, fuel, keys returned, new damages found).
6. Click **End contract**.

A closed contract can no longer be edited, but payments and deposit movements can still be recorded on it.

### Renewing a contract

Click **Renew**, set the new **Start date**, **End date**, **Monthly rent** and **Payment day of the month**, and click **Renew**. The current contract ends as "Renewed", a new contract starts the next day, and the deposit carries over to it.

### Handover and return checklists

On the **Overview** tab, the **Handover checklist** and **Return checklist** cards each have **Edit**. Print them with **Generate PDF** (section 12), and upload car photos to the contract's **Documents** tab.

---

## 6. Ledger and deposits

Each driver has a ledger: every charge, payment, credit and deposit movement. It is on the driver's **Ledger** tab (all contracts) and on the contract's **Ledger** tab (that contract only). You can filter by dates and type.

### Entry types

- **Charge:** money the driver owes: **Rent** (automatic), or **Fine**, **Damage**, **Insurance**, **Annual test**, **Repair**, **Early-exit penalty**, **Other**.
- **Payment:** money received from the driver.
- **Credit:** money taken off the driver's debt (a discount, a correction, or the automatic credit when a contract ends early).

### Adding entries

On the ledger use **Record payment**, **Add charge** (choose the **Charge type**, **Amount**, **Date**, **Due date** and **Description**) or **Add credit**.

### Voiding a mistake

Entries are never deleted. To cancel a wrong entry, click **Void** on its row and write the **Reason**. The entry stays in the ledger, struck through, and no longer counts in the balance. **Show voided** shows or hides voided entries.

### Deposits

A deposit is held money, not a payment: it does **not** reduce the driver's balance. The ledger and the driver show it separately as **Deposit held**.

On a contract, the **Deposit** action offers:

- **Receive deposit:** record a deposit received (also done when the contract is activated).
- **Return deposit:** record that you gave the deposit back.
- **Apply deposit to debt:** take an amount from the deposit and pay it against the open debt. Both the deposit held and the balance go down.

Deposit and payment rows have a PDF button to print a **Deposit confirmation** or a **Payment confirmation** (section 12).

---

## 7. Traffic fines

Fines arrive at the registered owner, which is usually the business. They must be reassigned to the driver within 90 days of receiving them, or the business pays.

### Recording a fine

1. Go to **Fines** and click **Add fine** (or from the car's **Fines** tab).
2. Choose the **Car**, enter the **Offence date and time**, **Received on** (the 90-day deadline counts from this date), **Amount**, **Fine number** and **Issued by** (police, municipality, toll road).
3. Click **Save**.

The driver who had the car at the time of the offence is matched automatically from the leases ("Fine added and matched to ..."). The **Reassign by** date is calculated for you.

### Handling the fine

Click the fine to open it. There you can:

- Change the **Status**: **New**, **Reassignment submitted**, **Reassigned to driver**, **Paid by us**, **Cancelled**, then **Save**.
- Change the matched **Driver** if needed.
- **Rebill to driver:** if we paid the fine, add it as a charge in the driver's ledger. The fine is tagged "Charged to driver".

Fines close to the deadline show "Reassign soon"; fines past it show "Reassignment overdue". Both appear in the reminders and on the dashboard (**Open fines**).

---

## 8. Deals: purchases, sales, consignment

The **Deals** page lists all purchases and sales. The **New deal** button starts a sale; the arrow next to it (**Choose the deal type**) offers **New purchase**, **New sale** and **New consignment sale**. From a car's **Deals** tab the car is filled in for you.

A deal starts as **Draft**, and moves to **Completed** or **Cancelled**.

### Purchase

1. **New purchase**. Under **Car** choose **Car in the system** (a car outside the stock, returned or sold earlier, for a buy-back) or **New car** and type its details.
2. Under **Deal terms**: the **Seller**, **Deal date**, **Price**, and optionally **List price (Levi Yitzhak)** for comparison.
3. Tick **The seller is a VAT-registered business** if the seller deducted input VAT. That car will later be sold with full VAT.
4. Click **Create deal**, then **Complete deal** when the car is ours. Completing a purchase adds the car to the stock.

### Sale (with or without trade-in)

1. **New sale** (or **Sell this car** on the car). Choose the **Car** from our cars in stock. The form shows the purchase price and the days in stock.
2. Fill in the **Buyer**, **Deal date**, **Price** and optionally the **List price (Levi Yitzhak)**.
3. **VAT:** **VAT on margin** is the default (VAT is computed on the price minus the purchase price; a negative margin means no VAT). Choose **Full VAT** when needed. If the car was bought from a VAT-registered business the form forces full VAT. The form shows the VAT base, rate and amount.
4. **Trade-in:** switch on **The buyer trades in a car**, fill in the trade-in car (existing or new), the **Trade-in value** and the **List price of the trade-in**. The form shows the **Cash due from the buyer** (price minus the trade-in value). A linked purchase deal is created for the trade-in car automatically, and the trade-in counts as a payment on the sale.
5. **Warranty and notes:** the **Warranty** text is printed on the sale agreement in Hebrew (a default 30-day engine and gearbox text is offered).
6. Click **Create deal**.

### Consignment sale

1. **New consignment sale** (or **Consignment sale** on the car). Choose the consignment car. Its terms appear: **Consignor**, **Asking price**, **Minimum net to the consignor**, **Commission rule**.
2. Fill in the **Buyer**, **Deal date** and **Price**. The form computes the **Commission** and the **Payout to the consignor**, and warns when the payout is below the agreed minimum.
3. Click **Create deal**.
4. After the sale, pay the consignor and record it on the **Payments** tab with direction **Money out**. **Payout still due** shows what is left to pay.

### Deal payments

On the deal, **Record payment** records money in (**Money in**) or out (**Money out**): amount, date, method, reference and who paid or was paid (by default the buyer, the seller or, for a payout, the consignor). A down payment can be recorded before the deal is completed. The **Payments** tab shows **Received**, **Paid out** and **Still due**. Each row has a PDF button for a **Payment confirmation**. A wrong payment can be deleted; the automatic trade-in payment cannot.

### The disclosure form (before every sale)

Before completing a sale or a consignment sale, the buyer must sign the disclosure form. The system will not complete the sale without it.

1. On the deal click **Disclosure form** to print the form, and have the buyer sign it.
2. Click **Record disclosure**, enter the date it was **Signed on**, and click **Record**.
3. Upload the signed form to the deal's **Documents** tab with the type "Disclosure form".

### Completing the deal

Click **Complete deal**, check the **Completion date** and click **Complete**. A sale cannot be completed if:

- the buyer has not signed the disclosure form, or
- the car is still on an active lease (end the lease first).

Completing a sale closes the car's inventory cycle, marks the car **Sold**, completes the linked trade-in purchase, and sets the **Transfer due by** date: 6 working days after the sale.

### Ownership transfer

After a completed sale, the **Transfer** tab holds the **Ownership transfer checklist**: ID copies collected, vehicle licence signed, liens checked, outstanding fines checked, transfer filed, new vehicle licence received, insurance cancelled or moved, and for a taxi, taxi licence detached. Each tick is saved immediately. When the buyer is registered, click **Mark transferred** and enter the **Transferred on** date.

The buyer must be registered within 6 working days of the sale. A late transfer shows "Transfer overdue" on the deal, in the reminders and on the dashboard (**Transfers overdue**).

### Cancelling a deal

**Cancel deal** (with a **Reason**) works only on a deal that is not completed yet. Delete its recorded payments first. The deal is kept, marked **Cancelled**, and the car goes back to its previous state. Cancelling a sale also cancels its trade-in purchase.

### Editing

**Edit** on an open deal changes its terms. On a completed deal only the warranty and the notes can be changed.

---

## 9. Reminders and the bell

The system collects every date that needs attention into one list:

- **Expiries:** vehicle licence and test, insurance policies, driving licences, taxi permits, medical certificates, documents with an expiry date.
- **Taxi licences:** the annual fee and the renewal date; taxi age (the semi-annual test from year 10 and the 12-year limit).
- **Deadlines:** lease ending, ownership transfer after a sale, fine reassignment, the 12-month dealer registration.
- **Follow-ups:** the follow-up date on a contact.
- **Manual reminders** that you add yourself.

### The bell

The bell in the top bar counts the items that are overdue or due soon, and refreshes every few minutes. Click it to see them grouped, click an item to open its record, or click **See all reminders**.

### The Reminders page

- **All expiries:** the full list with **Urgency** (**Overdue**, **Due soon**, **Upcoming**), **Kind** and the date range (next 30, 60 or 90 days).
- **Manual reminders:** your own reminders. **Add reminder**, then fill in **Title**, **Due date** and notes. Tick **Done** when it is handled (or **Mark done** in the bell). **Show completed** shows the ones already done.

You can also click **Add reminder** on a car, a driver or a lease, so the reminder is linked to that record.

Automatic items cannot be marked done: they disappear once you update the record, for example by entering the new expiry date, marking the transfer done or changing the fine's status.

### When an item counts as "due soon"

How many days before the date an item counts as "due soon" is set in **Settings** > **Reminder timing** (section 13).

---

## 10. Contacts and leads

**Contacts** holds everyone you deal with: buyers, sellers, drivers, garages, insurers, consignors and leads.

- **New contact:** choose **Person** or **Company**, fill in the name, **ID / company number** (checked for a valid check digit), phones, email, address, **Preferred language** (used for the PDFs) and **Source** (for example Yad2, referral, walk-in).
- **Tags:** Buyer, Seller, Driver, Lead, Supplier, Garage, Insurer, Consignor. Filter the list by tag.
- **Follow-up date:** the contact appears in the reminders on that date. **Follow-ups due** filters the ones to call today.
- **Archive:** hides a contact from lists and pickers without deleting it. **Show archived** shows them; **Restore** brings one back.

A contact page also shows the contact's deals and documents, and links to the driver profile when there is one. Most pickers (buyer, seller, consignor) also offer **Create a new contact** on the spot.

---

## 11. Dashboard and reports

### Dashboard

The dashboard shows today's situation. Each number has an info icon (**What this number means**).

- **Vehicles in stock**, **Active leases**, **Driver receivables** (what drivers owe, and how much is overdue), **Profit this month**, **Open deals**, **Transfers overdue**, **Expiries overdue**, **Open fines**.
- **Expiring soon:** the next expiries, with **View all**.
- Charts: **Profit by month**, **Receivables ageing**, **Inventory**, each with **View report**.
- **Recent activity:** the latest changes in the system.

### Reports

**Reports** lists seven reports: **Profit**, **Inventory ageing**, **Receivables**, **Expenses**, **Lease income**, **Trade book** and **Fines**. Click **Open report**.

- Choose the period (**From** / **To**, or quick periods such as **This month**, **Last month**, **Year to date**, **Last year**, **Last 30 days**). Inventory ageing and Receivables use a single **As of** date instead.
- Some reports have **Group by** (for example month, quarter or year for Profit).
- **Export Excel** or **Export CSV** downloads the report in the current screen language, ready for the accountant.

**Trade book:** every car bought or sold in the period, with the seller and buyer, their ID numbers, the prices and the repairs. Export it to Excel and hand it to the accountant.

---

## 12. Printable PDFs

The system prints ready-made documents with the business details from **Settings** > **Business details**.

### Where to find each document

- **Lease agreement**, **Handover report**, **Return report:** on the lease, **Generate PDF**, then choose the document. The handover and return reports exist only for a car + licence lease (the return report after activation).
- **Deposit confirmation**, **Payment confirmation:** the PDF button on a deposit or payment row in the ledger.
- **Sale agreement** / **Purchase agreement:** an action with that name on the deal (the sale agreement also serves a consignment sale).
- **Disclosure form:** an action on a sale or a consignment sale.
- **Payment confirmation** for a deal payment: the PDF button on the payment row.
- **Consignment agreement:** an action on a car that is on consignment.

### Choosing the language

The window lets you choose the **Language**: **Customer's language** (the **Preferred language** on the customer's contact card, otherwise yours), **Hebrew**, **Arabic** or **English**. Click **Generate**.

### Where the PDF is kept

The PDF opens in a new tab, and a copy is stored in the system:

- Lease documents in the lease's **Documents** tab.
- Deal documents, including payment confirmations of deal payments, in the deal's **Documents** tab.
- The consignment agreement in the car's **Documents** tab.
- Deposit and payment confirmations from the driver ledger are stored with the ledger entry and are not listed in a Documents tab: save or print them when they open, or generate them again later from the same row.

Each click creates a new copy, so you can regenerate a document after correcting the data. If the browser blocks the new tab, allow pop-ups for the site, or open the document from the Documents tab.

---

## 13. Settings

### Business details

**Fill these in before you print any contract.** Every contract, agreement and form prints them.

- **Name in Hebrew**, **Name in Arabic**, **Name in English**.
- **Company / licensed-dealer number** and **Car dealer licence number** (the dealer licence number must appear on sale agreements).
- **Address**, **Phone**, **Email**.
- **VAT rate** (%), used for new deals; existing deals keep their rate.

Click **Save**. **Reset** discards unsaved changes.

### Contracts

Defaults for new lease contracts:

- **Default responsibilities:** who pays insurance, the annual test, repairs and fines (**Us** or **Driver**). New contracts start with these; each contract can change them.
- **Standard clauses:** **Clauses in Hebrew**, **Clauses in Arabic**, **Clauses in English**. They are printed on the lease contract in the contract's language; if the chosen language is empty, the Hebrew clauses are printed. The **Contract terms** of a specific contract are printed in addition.

### Reminder timing

How many days before each kind of date it shows as "due soon" in the reminders and the bell: vehicle licence (annual test), insurance, driving licence, taxi permit, medical certificate, taxi licence fee and renewal, lease end, document expiry, dealer registration, ownership transfer, fine reassignment, taxi age. Defaults: 30 days for vehicles, insurance, leases and documents; 60 for driver licences, permits, medical certificates and the licence fee; 2 for the ownership transfer; 14 for fines; 90 for taxi age.

### Backup

Shows the state of the nightly backup. See the next section.

---

## 14. Backups

Every night at 02:30 Israel time the system backs up the whole database and all uploaded documents to cloud storage.

**Settings** > **Backup** shows:

- **Status:** **Up to date** (a backup succeeded in the last 36 hours), **Out of date** (in red: no successful backup for more than 36 hours) or **No backup has run yet**.
- **Last successful backup** (date and time) and **Backup file**.
- **Refresh** to check again.

If the status is **Out of date**, or the page says "Backup monitoring is not set up on this server", contact whoever runs the server the same day. Do not wait for a second night. The technical restore steps for that person are in [ops/restore.md](ops/restore.md).

---

## 15. Legal notes

These notes are practical reminders, not legal advice. Check anything unclear with your lawyer or accountant.

- **Payment and deposit confirmations are not tax documents.** A "Payment confirmation" (אישור תשלום) or a "Deposit confirmation" is not a tax invoice or receipt. Issue fiscal invoices and receipts from your accounting system.
- **Have a lawyer review the templates.** The wording of the contracts, agreements, forms and your standard clauses are templates. Have them reviewed by a lawyer before using them with customers and drivers.
- **Drivers are independent contractors.** Lease contracts should describe the driver as an independent contractor who leases a licence or a car, not as an employee. This lowers the risk of the relationship being treated as employment.
- **Disclosure form before every sale.** The disclosure form is a legal duty before every sale, consignment sales included, signed by the buyer. The system blocks completing a sale until you record it.
- **Register the buyer within 6 working days.** Follow the **Transfer** tab and the overdue alerts.
- **Reassign fines in time.** Fines must be reassigned to the driver within 90 days of receipt; after that the business carries them.
- **Personal data is sensitive.** The system holds ID numbers, driving licences and scanned documents. Keep your password private, do not share the account, and always log out on shared computers.
