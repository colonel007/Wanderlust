// One-time migration: gives every listing without categories a `categories` array.
//
// Usage (from project root):
//   node scripts/assignCategories.js --dry     # preview only, writes nothing
//   node scripts/assignCategories.js           # apply
//
// Rules:
//  1. Listing already has a legacy single `category` -> becomes categories: [thatValue]
//  2. Otherwise keyword-match the TITLE (all matches, max 3);
//     if the title matches nothing, try the DESCRIPTION;
//     if still nothing, use DEFAULT_CATEGORIES.
// Owners can fine-tune any listing later via the Edit form.

require("dotenv").config();
const mongoose = require("mongoose");
const Listing = require("../models/listing.js");

// >>> Use the same connection string your app.js uses <<<
const DB_URL =
    process.env.ATLASDB_URL ||
    process.env.MONGO_URL ||
    "mongodb://127.0.0.1:27017/wanderlust";

const DEFAULT_CATEGORIES = ["Trending"];
const MAX_CATEGORIES = 3;
const DRY_RUN = process.argv.includes("--dry");

const RULES = [
    { category: "Domes",         words: ["dome", "geodesic"] },
    { category: "Boats",         words: ["boat", "houseboat", "yacht", "sail", "cruise", "ship"] },
    { category: "Castles",       words: ["castle", "fort", "palace", "haveli", "heritage"] },
    { category: "Arctic",        words: ["arctic", "igloo", "snow", "ski", "glacier", "ice"] },
    { category: "Camping",       words: ["camp", "tent", "glamp", "bonfire"] },
    { category: "Farms",         words: ["farm", "ranch", "barn", "vineyard", "countryside", "village"] },
    { category: "Mountains",     words: ["mountain", "hill", "peak", "himalaya", "alpine", "valley", "cabin", "retreat"] },
    { category: "Amazing Pools", words: ["pool", "beach", "lake", "swim", "lagoon", "villa"] },
    { category: "Iconic cities", words: ["city", "downtown", "loft", "urban", "skyline", "penthouse", "metro"] },
    { category: "Rooms",         words: ["room", "studio", "hostel", "bnb", "apartment", "suite", "flat"] },
];

function matchCategories(text) {
    const lower = (text || "").toLowerCase();
    return RULES.filter((r) => r.words.some((w) => lower.includes(w)))
        .map((r) => r.category)
        .slice(0, MAX_CATEGORIES);
}

function guessCategories(doc) {
    // 1. Carry over the legacy single-category field if present
    if (doc.category) return [doc.category];

    // 2. Title first, then description, then default
    const fromTitle = matchCategories(doc.title);
    if (fromTitle.length) return fromTitle;

    const fromDescription = matchCategories(doc.description);
    if (fromDescription.length) return fromDescription;

    return DEFAULT_CATEGORIES;
}

async function main() {
    await mongoose.connect(DB_URL);
    console.log(`Connected. ${DRY_RUN ? "[DRY RUN] " : ""}Scanning listings without categories...`);

    // Native collection access so we can still read the legacy `category`
    // field, which no longer exists in the Mongoose schema.
    const docs = await Listing.collection
        .find({
            $or: [{ categories: { $exists: false } }, { categories: { $size: 0 } }],
        })
        .project({ title: 1, description: 1, category: 1 })
        .toArray();

    console.log(`Found ${docs.length} listing(s) to update.\n`);

    const ops = [];
    const summary = {};

    for (const doc of docs) {
        const categories = guessCategories(doc);
        categories.forEach((c) => (summary[c] = (summary[c] || 0) + 1));
        console.log(`  ${String(doc.title).padEnd(40)} -> ${categories.join(", ")}`);

        ops.push({
            updateOne: {
                filter: { _id: doc._id },
                update: {
                    $set: { categories },
                    $unset: { category: "" }, // remove the legacy field
                },
            },
        });
    }

    console.log("\nCategory counts:", summary);

    if (!DRY_RUN && ops.length) {
        const result = await Listing.collection.bulkWrite(ops);
        console.log(`\nUpdated ${result.modifiedCount} listing(s).`);
    } else if (DRY_RUN) {
        console.log("\nDry run complete. Nothing was written.");
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});