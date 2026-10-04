// Single source of truth for listing categories.
// Used by: model (enum), Joi schema (validation), controller (filtering),
// and the views (filter bar + dropdowns).
const CATEGORIES = [
    { name: "Trending",      icon: "fa-solid fa-fire" },
    { name: "Rooms",         icon: "fa-solid fa-bed" },
    { name: "Iconic cities", icon: "fa-solid fa-mountain-city" },
    { name: "Mountains",     icon: "fa-solid fa-mountain" },
    { name: "Castles",       icon: "fa-brands fa-fort-awesome" },
    { name: "Amazing Pools", icon: "fa-solid fa-person-swimming" },
    { name: "Camping",       icon: "fa-solid fa-campground" },
    { name: "Farms",         icon: "fa-solid fa-cow" },
    { name: "Arctic",        icon: "fa-solid fa-snowflake" },
    { name: "Domes",         icon: "fa-solid fa-landmark-dome" },
    { name: "Boats",         icon: "fa-solid fa-sailboat" },
];

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);

module.exports = { CATEGORIES, CATEGORY_NAMES };