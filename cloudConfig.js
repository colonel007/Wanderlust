const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET
});

// Upload image to Cloudinary
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "wanderlust_DEV",
                allowed_formats: ["jpg", "jpeg", "png"]
            },
            (error, result) => {

                if (error) {
                    console.log("========== CLOUDINARY ERROR ==========");
                    console.log("Message:", error.message);
                    console.log("HTTP Code:", error.http_code);
                    console.log("Full Error:", error);
                    console.log("======================================");

                    reject(error);
                } else {

                    console.log("========== CLOUDINARY SUCCESS ==========");
                    console.log("URL:", result.secure_url);
                    console.log("Public ID:", result.public_id);
                    console.log("========================================");

                    resolve(result);
                }
            }
        );

        uploadStream.end(buffer);
    });
};

module.exports = {
    cloudinary,
    uploadToCloudinary
};