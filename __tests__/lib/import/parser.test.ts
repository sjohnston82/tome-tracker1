import { describe, it, expect } from "vitest";
import { detectFormat, suggestMapping, applyMapping } from "@/lib/import/parser";
import { extractSeriesFromTitle } from "@/lib/import/goodreads";

describe("Import parser", () => {
  describe("detectFormat", () => {
    it("detects Goodreads format", () => {
      const headers = ["Book Id", "Title", "Author", "Bookshelves"];
      expect(detectFormat(headers)).toBe("goodreads");
    });

    it("detects StoryGraph format", () => {
      const headers = ["Title", "Author", "Read Status", "Star Rating"];
      expect(detectFormat(headers)).toBe("storygraph");
    });

    it("detects generic CSV", () => {
      const headers = ["Title", "Author", "ISBN"];
      expect(detectFormat(headers)).toBe("csv");
    });
  });

  describe("suggestMapping", () => {
    it("maps common column names", () => {
      const headers = ["Book Title", "Author Name", "ISBN-13", "Year Published"];
      const mapping = suggestMapping(headers);

      expect(mapping.title).toBe("Book Title");
      expect(mapping.author).toBe("Author Name");
      expect(mapping.isbn).toBe("ISBN-13");
      expect(mapping.publicationYear).toBe("Year Published");
    });
  });

  describe("applyMapping", () => {
    it("extracts data using mapping", () => {
      const row = {
        Title: "Mistborn",
        Author: "Brandon Sanderson",
        ISBN: "9780765311788",
      };
      const mapping = {
        title: "Title",
        author: "Author",
        isbn: "ISBN",
        seriesName: null,
        seriesNumber: null,
        publisher: null,
        publicationYear: null,
      };

      const result = applyMapping(row, mapping);

      expect(result).toEqual({
        title: "Mistborn",
        author: "Brandon Sanderson",
        isbn: "9780765311788",
      });
    });

    it("returns null for missing required fields", () => {
      const row = { Title: "Mistborn" };
      const mapping = {
        title: "Title",
        author: "Author",
        isbn: null,
        seriesName: null,
        seriesNumber: null,
        publisher: null,
        publicationYear: null,
      };

      expect(applyMapping(row, mapping)).toBeNull();
    });
  });

  describe("extractSeriesFromTitle", () => {
    it("extracts series from Goodreads format", () => {
      const result = extractSeriesFromTitle(
        "The Way of Kings (The Stormlight Archive, #1)"
      );

      expect(result.cleanTitle).toBe("The Way of Kings");
      expect(result.seriesName).toBe("The Stormlight Archive");
      expect(result.seriesNumber).toBe(1);
    });

    it("handles titles without series", () => {
      const result = extractSeriesFromTitle("Standalone Book");

      expect(result.cleanTitle).toBe("Standalone Book");
      expect(result.seriesName).toBeUndefined();
    });
  });
});
