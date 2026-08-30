-- ANN index for RAG retrieval.
-- Without this, every `retrieveRelevantChunks` call is a sequential scan over
-- the whole DocChunk table. HNSW matches the cosine operator (`<=>`) used in
-- the query; the opclass must match or Postgres will ignore the index.
CREATE INDEX IF NOT EXISTS "DocChunk_embedding_hnsw_idx"
  ON "DocChunk" USING hnsw (embedding vector_cosine_ops);
