
interface ImgBBResponse {
  success: boolean;
  data?: {
    url: string;
    display_url: string;
    delete_url: string;
  };
  error?: {
    message: string;
  };
}

export const uploadImageToImgBB = async (
  imageBase64: string
): Promise<string> => {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new Error("IMGBB_API_KEY is missing");
  }

  if (!imageBase64 || typeof imageBase64 !== "string") {
    throw new Error("Invalid image data");
  }

  const formData = new FormData();

  formData.append("image", imageBase64);

  const response = await fetch(
    `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = (await response.json()) as ImgBBResponse;

  if (!response.ok || !result.success || !result.data?.url) {
    throw new Error(
      result.error?.message || "Image upload failed"
    );
  }

  return result.data.url;
};
