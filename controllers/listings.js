const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const { uploadToCloudinary } = require("../cloudConfig");
const { CATEGORIES, CATEGORY_NAMES } = require("../utils/categories");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

// Escape user input before putting it into a RegExp (prevents regex injection / ReDoS).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Normalises form input to a clean array: "Farms" -> ["Farms"], undefined -> []
const toCategoryArray = (value) => {
    const arr = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(arr)].filter((c) => CATEGORY_NAMES.includes(c));
};


// =============================
// INDEX  (all listings + category filter + search)
//   /listings
//   /listings?category=Farms
//   /listings?q=goa
//   /listings?q=goa&category=Boats
// =============================

module.exports.index = async (req, res) => {
    const { category, q } = req.query;
    const conditions = [];

    // ---- Category filter (whitelisted) ----
    // { categories: "Farms" } matches any listing whose array CONTAINS "Farms"
    let activeCategory = null;
    if (typeof category === "string" && CATEGORY_NAMES.includes(category)) {
        activeCategory = category;
        conditions.push({ categories: activeCategory });
    }

    // ---- Search: title / location / country, case-insensitive, partial ----
    // "goa india" => every word must match at least one of the three fields.
    let searchTerm = "";
    if (typeof q === "string" && q.trim()) {
        searchTerm = q.trim().slice(0, 100);
        const terms = searchTerm.split(/\s+/).slice(0, 5);

        terms.forEach((term) => {
            const regex = new RegExp(escapeRegex(term), "i");
            conditions.push({
                $or: [{ title: regex }, { location: regex }, { country: regex }],
            });
        });
    }

    const filter = conditions.length ? { $and: conditions } : {};
    const allListings = await Listing.find(filter);

    res.render("listings/index.ejs", {
        allListings,
        categories: CATEGORIES,
        activeCategory,
        q: searchTerm,
    });
};


// =============================
// NEW FORM
// =============================

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", { categories: CATEGORIES });
};


// =============================
// SHOW
// =============================

module.exports.showListing = async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author",
            },
        })
        .populate("owner");

    if (!listing) {
        req.flash("error", "Cannot find that listing");
        return res.redirect("/listings");
    }

    res.render("listings/show.ejs", { listing });
};


// =============================
// CREATE LISTING
// =============================

module.exports.createListing = async (req, res) => {
    if (!req.file) {
        req.flash("error", "Please upload an image for the listing");
        return res.redirect("/listings/new");
    }

    const response = await geocodingClient
        .forwardGeocode({
            query: req.body.listing.location,
            limit: 1,
        })
        .send();

    const feature = response.body.features[0];
    if (!feature) {
        req.flash("error", "Could not find that location on the map. Try a more specific one.");
        return res.redirect("/listings/new");
    }

    // multer.memoryStorage() => file lives in req.file.buffer
    const uploadedImage = await uploadToCloudinary(req.file.buffer);

    const newListing = new Listing(req.body.listing);

    newListing.categories = toCategoryArray(req.body.listing.categories);
    newListing.owner = req.user._id;
    newListing.image = {
        url: uploadedImage.secure_url,
        filename: uploadedImage.public_id,
    };
    newListing.geometry = feature.geometry;

    await newListing.save();

    req.flash("success", "Successfully created a new listing");
    res.redirect("/listings");
};


// =============================
// EDIT FORM
// =============================

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Cannot find that listing");
        return res.redirect("/listings");
    }

    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250,h_300,c_fill");

    res.render("listings/edit.ejs", {
        listing,
        originalImageUrl,
        categories: CATEGORIES,
    });
};


// =============================
// UPDATE LISTING
// =============================

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listingData = req.body.listing || req.body;

    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Cannot find that listing");
        return res.redirect("/listings");
    }

    if (listingData.location !== listing.location) {
        const response = await geocodingClient
            .forwardGeocode({ query: listingData.location, limit: 1 })
            .send();

        const feature = response.body.features[0];
        if (!feature) {
            req.flash("error", "Could not find that location on the map. Try a more specific one.");
            return res.redirect(`/listings/${id}/edit`);
        }
        listing.geometry = feature.geometry;
    }

    // ---- Normal fields ----
    listing.title = listingData.title;
    listing.description = listingData.description;
    listing.price = listingData.price;
    listing.location = listingData.location;
    listing.country = listingData.country;
    listing.categories = toCategoryArray(listingData.categories); // NEW (multi)

    // ---- Image (only when a new file was picked) ----
    if (req.file) {
        const uploadedImage = await uploadToCloudinary(req.file.buffer);
        listing.image = {
            url: uploadedImage.secure_url,
            filename: uploadedImage.public_id,
        };
    }

    await listing.save();

    req.flash("success", "Successfully updated the listing");
    res.redirect(`/listings/${id}`);
};


// =============================
// DELETE LISTING
// =============================

module.exports.deleteListing = async (req, res) => {
    const { id } = req.params;

    await Listing.findByIdAndDelete(id);

    req.flash("error", "Successfully deleted the listing");
    res.redirect("/listings");
};