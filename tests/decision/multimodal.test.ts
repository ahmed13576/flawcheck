import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionValidationError } from "../../lib/decision/types";
import { SubQSnapDecisionProvider } from "../../lib/decision/providers/subq-snap";

const IMAGE_FIXTURES = {
  "image/png": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p1sAAAAASUVORK5CYII=",
  "image/jpeg": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAoD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AR//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AR//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Asf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2Q==",
  "image/webp": "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==",
} as const;

function successfulResponse() {
  return new Response(JSON.stringify({
    answers: {
      selection: {
        type: "choice",
        choice: "rounded",
        probabilities: { rounded: 0.9, linear: 0.1 },
        confidence: 0.9,
      },
    },
    usage: { input_tokens: 12, output_tokens: 0 },
  }), { status: 200 });
}

describe("SubQ image payloads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([1, 2, 4])("sends %i supported images with raw base64", async (imageCount) => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const mediaTypes = ["image/png", "image/jpeg", "image/webp", "image/png"] as const;

    await provider.choice({
      state: { indication: "dye penetrant bleed-out beside an ultrasonic A-scan" },
      images: Array.from({ length: imageCount }, (_, index) => ({
        mediaType: mediaTypes[index],
        base64: `data:${mediaTypes[index]};base64,${IMAGE_FIXTURES[mediaTypes[index]]}`,
      })),
    }, {
      instructions: "Classify the visible NDT indication as linear or rounded.",
      criteria: { linear: "linear crack-like indication", rounded: "rounded indication" },
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.images).toHaveLength(imageCount);
    expect(body.images[0]).toEqual({ mediaType: mediaTypes[0], base64: IMAGE_FIXTURES[mediaTypes[0]] });
    expect(body.questions.selection.type).toBe("choice");
  });

  it("strips a JPEG data URI prefix from an image inspection request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });

    await provider.batch({ state: "PT indication", images: [{
      mediaType: "image/jpeg",
      base64: `data:image/jpeg;base64,${IMAGE_FIXTURES["image/jpeg"]}`,
    }] }, {
      selection: { type: "choice", instructions: "Classify the indication", criteria: { rounded: "round", linear: "line" } },
    });

    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.images[0].base64).toBe(IMAGE_FIXTURES["image/jpeg"]);
    expect(body.images[0].base64).not.toContain("data:");
  });

  it("rejects a decoded image larger than 4 MiB before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const tooLarge = "A".repeat(Math.ceil((4 * 1024 * 1024 * 4) / 3) + 4);

    await expect(provider.batch({ state: "image", images: [{ mediaType: "image/png", base64: tooLarge }] }, {
      inspection: { type: "noul", instructions: "Check image" },
    })).rejects.toBeInstanceOf(DecisionValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects combined image data larger than 8 MiB before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const justOverTwoMiB = "A".repeat(Math.ceil((2 * 1024 * 1024 * 4) / 3) + 4);
    const images = Array.from({ length: 4 }, () => ({ mediaType: "image/webp" as const, base64: justOverTwoMiB }));

    await expect(provider.batch({ state: "images", images }, {
      inspection: { type: "noul", instructions: "Check images" },
    })).rejects.toBeInstanceOf(DecisionValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported media types and malformed base64 before dispatch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new SubQSnapDecisionProvider({ apiKey: "test-key" });
    const questions = { inspection: { type: "noul" as const, instructions: "Check image" } };

    await expect(provider.batch({ state: "image", images: [{ mediaType: "image/gif" as "image/png", base64: IMAGE_FIXTURES["image/png"] }] }, questions))
      .rejects.toBeInstanceOf(DecisionValidationError);
    await expect(provider.batch({ state: "image", images: [{ mediaType: "image/png", base64: "%%%" }] }, questions))
      .rejects.toBeInstanceOf(DecisionValidationError);
    await expect(provider.batch({ state: "image", images: [{ mediaType: "image/png", base64: "A=" }] }, questions))
      .rejects.toBeInstanceOf(DecisionValidationError);
    await expect(provider.batch({ state: "image", images: [{ mediaType: "image/png", base64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//" }] }, questions))
      .rejects.toBeInstanceOf(DecisionValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
