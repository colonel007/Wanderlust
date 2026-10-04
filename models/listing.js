const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const { CATEGORY_NAMES } = require("../utils/categories.js");

const listingSchema = new Schema({
    title: {
        type: String,
        required: true,
    },

    description: String,

    image: {
        url: String,
        filename: String,
    },

    price: {
        type: Number,
        required: true,
    },

    location: {
        type: String,
        required: true,
    },

    country: {
        type: String,
        required: true,
    },

    categories: {
        type: [
            {
                type: String,
                enum: CATEGORY_NAMES,
            },
        ],
        default: [],
    },

    reviews: [
        {
            type: Schema.Types.ObjectId,
            ref: "Review",
        },
    ],
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    geometry: {
        type: {
            type: String,
            enum: ["Point"],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    },
});

// Multikey index: speeds up { categories: "Farms" } lookups.
listingSchema.index({ categories: 1 });

listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing) {
        await Review.deleteMany({
            _id: { $in: listing.reviews },
        });
    }
});

const Listing = mongoose.model("Listing", listingSchema);

module.exports = Listing;