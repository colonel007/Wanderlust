// fixGeometry.js
//
// ONE-TIME SCRIPT. Run once with:  node fixGeometry.js
//
// Finds every listing that has no valid geometry.coordinates and
// geocodes it using the location + country fields, then saves it.
//
// This does NOT touch app.js, controllers, or views. It only writes
// to the database, using the same Listing model and Mapbox client
// your app already uses.

require("dotenv").config();

const mongoose = require("mongoose");
const Listing = require("./models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");

const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

// CHANGE THIS if your DB connection string / name is different
const MONGO_URL = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB");

    const allListings = await Listing.find({});
    console.log(`Found ${allListings.length} total listings`);

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const listing of allListings) {

        const hasValidGeo =
            listing.geometry &&
            Array.isArray(listing.geometry.coordinates) &&
            listing.geometry.coordinates.length === 2 &&
            !Number.isNaN(listing.geometry.coordinates[0]) &&
            !Number.isNaN(listing.geometry.coordinates[1]);

        if (hasValidGeo) {
            skipped++;
            continue;
        }

        const query = [listing.location, listing.country].filter(Boolean).join(", ");

        try {
            const response = await geocodingClient
                .forwardGeocode({ query, limit: 1 })
                .send();

            const features = response.body.features;

            if (!features || !features.length) {
                console.log(`  NOT FOUND: "${listing.title}" (${query})`);
                failed++;
                continue;
            }

            listing.geometry = features[0].geometry;
            await listing.save();

            console.log(`  FIXED: "${listing.title}" -> ${JSON.stringify(listing.geometry.coordinates)}`);
            fixed++;

        } catch (err) {
            console.log(`  ERROR on "${listing.title}":`, err.message);
            failed++;
        }
    }

    console.log("\n--- Done ---");
    console.log(`Fixed:   ${fixed}`);
    console.log(`Skipped (already had geometry): ${skipped}`);
    console.log(`Failed:  ${failed}`);

    await mongoose.connection.close();
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});