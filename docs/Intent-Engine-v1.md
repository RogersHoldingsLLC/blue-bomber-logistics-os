# Intent Engine v1

## Ownership Model

Sales Lead:
- Relationship management
- Calls
- Prospecting
- Customer communication
- Follow ups
- Opportunity development

Operations Lead:
- Research
- Contact discovery
- Better numbers
- New POCs
- Carrier development
- BOLs
- PODs
- Load tenders
- System administration

Default:
- Sales Lead = Louie
- Operations Lead = Brian

---

## Task Intents

Need Better Number
-> Create Task: Find Better Number
-> Owner: Operations Lead

Need New POC
-> Create Task: Find New POC
-> Owner: Operations Lead

Call Monday
-> Create Task: Call Contact
-> Owner: Sales Lead

Follow Up
-> Create Task: Follow Up
-> Owner: Sales Lead

Need Email
-> Create Task: Send Email
-> Owner: Sales Lead

Quote Request
-> Create Task: Provide Quote
-> Owner: Sales Lead
-> Priority: High

Need Carrier Base
-> Create Task: Build Carrier Base
-> Owner: Operations Lead

Build BOL
-> Create Task: Generate BOL
-> Owner: Operations Lead

Dormant Prospect
-> Create Task: Re-engage Prospect
-> Owner: Sales Lead

---

## Activity Intents

LVM
-> Timeline Entry: Left Voicemail
-> Update Last Activity

Talked to Contact
-> Timeline Entry
-> Update Last Contact
-> Update Contact Last Contact
-> Update Company Activity

Sent Quote
-> Timeline Entry
-> Update Last Activity

Received Tender
-> Timeline Entry
-> Update Last Activity

First Load Moved
-> Timeline Entry
-> Update Status: Customer

---

## Contact Activity Rule

Example:
Talked to Aaron today.

System:
1. Creates timeline entry
2. Updates company Last Contact
3. Updates Aaron Last Contact
4. Updates company Last Activity
5. Marks company active

If contact does not exist:
Prompt to create contact.

---

## Company Rules

Every company must have:
- Sales Lead
- Operations Lead
- Primary Contact
- Current Opportunity
- Last Contact
- Last Activity

Every company must have an open next step.

Next Task = oldest open task associated with the company.
