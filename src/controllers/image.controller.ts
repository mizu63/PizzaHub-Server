
import type { RequestHandler } from "express";

import { uploadImageToImgBB } from "../services/image.service.js";

export const uploadImage: RequestHandler = async (req, res) => {
  try {
    const { image } = req.body as {
      image?: unknown;
    };

    if (typeof image !== "string" || !image.trim()) {
      res.status(400).json({
        success: false,
        message: "Please provide an image",
      });
      return;
    }

    // Accept Base64 image data only
    const base64Pattern =
      /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/i;

    if (!base64Pattern.test(image)) {
      res.status(400).json({
        success: false,
        message: "Only JPG, PNG and WEBP images are allowed",
      });
      return;
    }

    // Limit image size to 5 MB
    const base64Data = image.split(",")[1] ?? "";
    const imageSize = Math.ceil((base64Data.length * 3) / 4);

    if (imageSize > 5 * 1024 * 1024) {
      res.status(400).json({
        success: false,
        message: "Image size must be 5 MB or less",
      });
      return;
    }

    const imageUrl = await uploadImageToImgBB(base64Data);

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        imageUrl,
      },
    });
  } catch (error) {
    console.error("Image Upload Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
};
