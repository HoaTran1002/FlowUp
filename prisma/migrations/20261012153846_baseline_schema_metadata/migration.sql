-- CreateTable
CREATE TABLE "schema_metadata" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schema_metadata_pkey" PRIMARY KEY ("key")
);
