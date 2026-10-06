const { setGlobalOptions } = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// Cost control: cap concurrent containers per function
setGlobalOptions({ maxInstances: 10 });

/**
 * Callable Cloud Function: uploadToImgBB
 *
 * Receives a base64-encoded image from the client and uploads it to ImgBB,
 * keeping the ImgBB API key secret on the server — never exposed to the browser.
 *
 * @param {object} data - { imageBase64: string } — the image as a base64 data URL or raw base64
 * @returns {{ url: string }} - The public ImgBB URL of the uploaded image
 */
exports.uploadToImgBB = onCall(
  { secrets: ["IMGBB_API_KEY"] },
  async (request) => {
    // Must be authenticated to upload
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to upload images."
      );
    }

    const { imageBase64 } = request.data;

    if (!imageBase64 || typeof imageBase64 !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "A base64-encoded image string is required."
      );
    }

    // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      logger.error("IMGBB_API_KEY secret is not configured.");
      throw new HttpsError("internal", "Image upload service is not configured.");
    }

    try {
      const formData = new URLSearchParams();
      formData.append("image", base64Data);

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${apiKey}`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("ImgBB API error:", errorText);
        throw new HttpsError("internal", "Failed to upload image to ImgBB.");
      }

      const result = await response.json();
      logger.info("Image uploaded successfully:", result.data.url);
      return { url: result.data.url };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("Unexpected error uploading to ImgBB:", error);
      throw new HttpsError("internal", "An unexpected error occurred during image upload.");
    }
  }
);
