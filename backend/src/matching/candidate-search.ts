import { Model } from "mongoose";
import itemModel, { IItem } from "../models/item_model";
import { ItemType } from "./types";

export interface SearchQuery {
  _id: string;
  itemType: ItemType;
  category?: string;
  embedding: number[];
}

export interface Candidate {
  item: IItem & { _id: string };
  /** 0..1, higher is more similar */
  similarity: number;
}

/** Finds the items most likely to be the same object as the query item. */
export interface CandidateSearch {
  find(query: SearchQuery, limit: number): Promise<Candidate[]>;
}

const opposite = (t: ItemType): ItemType => (t === "lost" ? "found" : "lost");

export const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};

/** MongoDB Atlas Vector Search (approximate nearest neighbours, HNSW). Index: atlas/vector-index.json */
export class AtlasCandidateSearch implements CandidateSearch {
  constructor(
    private readonly model: Pick<Model<IItem>, "aggregate"> = itemModel,
    private readonly indexName = "item_embedding_index"
  ) {}

  async find(query: SearchQuery, limit: number): Promise<Candidate[]> {
    const filters: Record<string, unknown>[] = [{ itemType: opposite(query.itemType) }, { isResolved: false }];
    if (query.category) filters.push({ category: query.category });

    const rows = await this.model.aggregate([
      {
        $vectorSearch: {
          index: this.indexName,
          path: "embedding",
          queryVector: query.embedding,
          // ~20x the limit keeps ANN recall high
          numCandidates: limit * 20,
          // +1 in case the query item itself is returned
          limit: limit + 1,
          filter: { $and: filters },
        },
      },
      { $project: { embedding: 0, similarity: { $meta: "vectorSearchScore" } } },
    ]);

    return rows
      .filter((row) => String(row._id) !== query._id)
      .slice(0, limit)
      .map(({ similarity, ...item }) => ({ item: { ...item, _id: String(item._id) }, similarity }));
  }
}

/**
 * Exact search in application memory, for tests and local MongoDB (no Atlas).
 * Fine for demo-sized data; production uses AtlasCandidateSearch.
 */
export class InMemoryCandidateSearch implements CandidateSearch {
  async find(query: SearchQuery, limit: number): Promise<Candidate[]> {
    const filter: Record<string, unknown> = {
      itemType: opposite(query.itemType),
      isResolved: false,
      _id: { $ne: query._id },
      "embedding.0": { $exists: true },
    };
    if (query.category) filter.category = query.category;

    const items = await itemModel.find(filter).select("+embedding").lean();
    return items
      .map(({ embedding, ...item }) => ({
        item: { ...item, _id: String(item._id) } as Candidate["item"],
        similarity: cosineSimilarity(query.embedding, embedding ?? []),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
}
