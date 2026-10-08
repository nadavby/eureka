import sharp from "sharp";
import { MAX_DIMENSION, processImage } from "../../images/process-image";
import { AppError } from "../../lib/errors";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } } });

/** A JPEG as a phone would produce it: landscape pixels, EXIF orientation 6 (rotate 90°), GPS position. */
const phoneJpeg = () =>
  solid(400, 200)
    .jpeg()
    .withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: "TestPhone" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "32/1 5/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "34/1 46/1 0/1" },
      },
    })
    .toBuffer();

describe("processImage", () => {
  it("re-encodes to WebP and strips EXIF, including GPS", async () => {
    const input = await phoneJpeg();
    expect((await sharp(input).metadata()).exif).toBeDefined(); // the fixture really has EXIF

    const out = await processImage(input);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(out.buffer.includes(Buffer.from("TestPhone"))).toBe(false);
  });

  it("applies the EXIF orientation before dropping it", async () => {
    const out = await processImage(await phoneJpeg());
    expect({ width: out.width, height: out.height }).toEqual({ width: 200, height: 400 });
  });

  it("fits large photos inside the maximum size and keeps the aspect ratio", async () => {
    const out = await processImage(await solid(4000, 3000).png().toBuffer());
    expect(out.width).toBe(MAX_DIMENSION);
    expect(out.height).toBe(1200);
  });

  it("does not upscale small images", async () => {
    const out = await processImage(await solid(300, 200).webp().toBuffer());
    expect({ width: out.width, height: out.height }).toEqual({ width: 300, height: 200 });
  });

  it("rejects data that is not an image, whatever its name or MIME type claims", async () => {
    for (const bytes of [Buffer.from("MZ\x90\x00 this is an exe"), Buffer.from("<svg onload=alert(1)>")]) {
      await expect(processImage(bytes)).rejects.toBeInstanceOf(AppError);
    }
  });

  it("rejects a truncated (corrupt) image", async () => {
    const jpeg = await solid(800, 600).jpeg().toBuffer();
    await expect(processImage(jpeg.subarray(0, 200))).rejects.toBeInstanceOf(AppError);
  });

  it("rejects SVG even though it is an image format", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    await expect(processImage(svg)).rejects.toThrow(/JPEG, PNG, WebP/);
  });
});
