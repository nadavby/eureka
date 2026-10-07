import fs from "fs";
import os from "os";
import path from "path";
import { CloudinaryImageStorage, LocalImageStorage } from "../../images/storage";

describe("LocalImageStorage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "eureka-storage-"));
  const storage = new LocalImageStorage(root, "http://localhost:3000/public");

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("writes the file under its folder and returns its public URL", async () => {
    const saved = await storage.save(Buffer.from("webp-bytes"), "items");
    expect(saved.url).toMatch(/^http:\/\/localhost:3000\/public\/items\/[0-9a-f-]{36}\.webp$/);
    expect(saved.publicId).toMatch(/^items\/[0-9a-f-]{36}\.webp$/);
    expect(fs.readFileSync(path.join(root, saved.publicId), "utf8")).toBe("webp-bytes");
  });

  it("removes a file, and ignores one that is already gone", async () => {
    const saved = await storage.save(Buffer.from("x"), "users");
    await storage.remove(saved.publicId);
    expect(fs.existsSync(path.join(root, saved.publicId))).toBe(false);
    await expect(storage.remove(saved.publicId)).resolves.toBeUndefined();
  });

  it("refuses ids that point outside its folders", async () => {
    await expect(storage.remove("../../etc/passwd")).rejects.toThrow(/invalid/i);
    await expect(storage.remove("items/../../secret.webp")).rejects.toThrow(/invalid/i);
  });
});

describe("CloudinaryImageStorage", () => {
  const fakeUploader = () => {
    const uploader = {
      options: undefined as Record<string, unknown> | undefined,
      received: Buffer.alloc(0),
      upload_stream: jest.fn((options: Record<string, unknown>, cb: (err: unknown, res?: unknown) => void) => {
        uploader.options = options;
        const chunks: Buffer[] = [];
        return {
          end: (buf: Buffer) => {
            chunks.push(buf);
            uploader.received = Buffer.concat(chunks);
            cb(undefined, { secure_url: "https://res.cloudinary.com/demo/image/upload/v1/eureka/items/abc.webp", public_id: "eureka/items/abc" });
          },
        };
      }),
      destroy: jest.fn().mockResolvedValue({ result: "ok" }),
    };
    return uploader;
  };

  it("uploads into the app's folder and returns the secure URL", async () => {
    const uploader = fakeUploader();
    const saved = await new CloudinaryImageStorage(uploader as never).save(Buffer.from("img"), "items");
    expect(saved).toEqual({
      url: "https://res.cloudinary.com/demo/image/upload/v1/eureka/items/abc.webp",
      publicId: "eureka/items/abc",
    });
    expect(uploader.options).toMatchObject({ folder: "eureka/items", resource_type: "image", format: "webp" });
    expect(uploader.received.toString()).toBe("img");
  });

  it("surfaces upload errors", async () => {
    const uploader = fakeUploader();
    uploader.upload_stream.mockImplementationOnce((_o, cb) => {
      cb(new Error("bad credentials"));
      return { end: () => undefined };
    });
    await expect(new CloudinaryImageStorage(uploader as never).save(Buffer.from("x"), "items")).rejects.toThrow(
      "bad credentials"
    );
  });

  it("deletes by public id", async () => {
    const uploader = fakeUploader();
    await new CloudinaryImageStorage(uploader as never).remove("eureka/items/abc");
    expect(uploader.destroy).toHaveBeenCalledWith("eureka/items/abc", { invalidate: true });
  });
});
