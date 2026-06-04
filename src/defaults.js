// Default settings + agreement, shared by the server (src/db.js) and the
// standalone preview builder (scripts/build-preview.mjs) so they never drift.

// Fully editable from the admin portal. This is a general template — have it
// reviewed by a lawyer before relying on it.
export const DEFAULT_AGREEMENT = `SHORT-TERM STAY & EQUIPMENT USE AGREEMENT

This Agreement is entered into between the Property Owner ("Owner") and the
person submitting this booking ("Guest").

1. BOOKING. The Guest is reserving the property for the dates and number of
   nights selected at booking. Maximum stay is 3 nights / 4 days. Maximum
   occupancy is 7 people total, including the person who booked. All guests
   must be listed at the time of booking with their full name and age.

2. PAYMENT. The base price for the stay is shown at checkout. If the Guest
   selects boating and/or the use of any gas-powered equipment, an additional
   gas charge applies. Final gas charges may be adjusted to actual usage.
   Payment is due as instructed after booking.

3. CONDUCT & CARE. The Guest agrees to treat the property and all equipment
   with care, to follow all posted rules, and to leave the property in the
   condition in which it was found. The Guest is responsible for the conduct
   of every person in their party.

4. BOATING & EQUIPMENT. Use of boats, watercraft, and any gas-powered or
   motorized equipment is entirely at the Guest's own risk. The Guest affirms
   that anyone operating such equipment is competent and legally permitted to
   do so, and will use all required safety equipment (including life jackets).

5. ASSUMPTION OF RISK & LIABILITY. The Guest understands that use of the
   property, the water, and the equipment involves inherent risks, including
   serious injury. To the fullest extent permitted by law, the Guest assumes
   these risks and releases the Owner from liability for injury, loss, or
   damage, except where caused by the Owner's gross negligence or willful
   misconduct.

6. DAMAGE. The Guest agrees to be responsible for any loss or damage to the
   property or equipment caused during the stay, beyond normal wear and tear.

7. IDENTIFICATION. The Guest agrees that identification provided (such as a
   driver's license or voter ID) is true and accurate.

8. CANCELLATION. Cancellations and changes are subject to the Owner's
   approval.

By signing below, the Guest confirms they have read, understood, and agree to
all of the terms above, and that they are at least 18 years of age and
authorized to make this booking on behalf of their entire party.`;

export const DEFAULT_SETTINGS = {
  property_name: 'The Lake House',
  base_price: '300',
  gas_fee: '150',
  max_nights: '3',
  max_guests: '7',
  payment_link: '',
  contact_email: '',
  contact_phone: '',
  agreement_text: DEFAULT_AGREEMENT,
};
