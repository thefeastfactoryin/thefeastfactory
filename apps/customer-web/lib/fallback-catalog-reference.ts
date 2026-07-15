/**
 * Historical catalog fallback reference.
 *
 * This is intentionally not imported by customer-facing UI. Keep it only as
 * a reference for development/migrations; catalog data must come from the API.
 */
export const FALLBACK_CATALOG_REFERENCE = {
  categories: [
    { id: 'all', label: 'All' },
    { id: 'veg-starters', label: 'Veg Starters' },
    { id: 'non-veg-starters', label: 'Non-Veg Starters' },
    { id: 'main-course', label: 'Main Course' },
    { id: 'rice-bread', label: 'Rice & Bread' },
    { id: 'dessert', label: 'Desserts' },
    { id: 'beverage', label: 'Beverages' },
  ],
  dishes: [
    ['vs1', 'Crispy Corn', 180, true, 'veg-starters'], ['vs2', 'Paneer Tikka', 220, true, 'veg-starters'], ['vs3', 'Veg Manchurian', 190, true, 'veg-starters'], ['vs4', 'Hara Bhara Kebab', 210, true, 'veg-starters'], ['vs5', 'Cheesy Corn Balls', 200, true, 'veg-starters'],
    ['nv1', 'Chicken Tikka', 260, false, 'non-veg-starters'], ['nv2', 'Chilli Chicken', 240, false, 'non-veg-starters'], ['nv3', 'Fish Amritsari', 290, false, 'non-veg-starters'], ['nv4', 'Mutton Seekh Kebab', 320, false, 'non-veg-starters'],
    ['mc1', 'Paneer Butter Masala', 250, true, 'main-course'], ['mc2', 'Dal Makhani', 200, true, 'main-course'], ['mc3', 'Veg Kofta Curry', 230, true, 'main-course'], ['mc4', 'Chicken Curry', 280, false, 'main-course'], ['mc5', 'Mutton Rogan Josh', 340, false, 'main-course'],
    ['rb1', 'Jeera Rice', 120, true, 'rice-bread'], ['rb2', 'Veg Biryani', 220, true, 'rice-bread'], ['rb3', 'Steamed Rice', 110, true, 'rice-bread'], ['rb4', 'Butter Naan', 40, true, 'rice-bread'], ['rb5', 'Tandoori Roti', 25, true, 'rice-bread'],
    ['ds1', 'Gulab Jamun', 120, true, 'dessert'], ['ds2', 'Rasmalai', 150, true, 'dessert'], ['ds3', 'Gajar Halwa', 140, true, 'dessert'], ['ds4', 'Vanilla Ice Cream', 100, true, 'dessert'],
    ['bv1', 'Fresh Lime Juice', 60, true, 'beverage'], ['bv2', 'Masala Chaas', 50, true, 'beverage'], ['bv3', 'Soft Drinks', 40, true, 'beverage'], ['bv4', 'Mango Lassi', 80, true, 'beverage'],
  ],
} as const;
