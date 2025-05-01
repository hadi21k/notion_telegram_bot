-- CreateTable
CREATE TABLE "NotionDatabase" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotionDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotionDatabase_databaseId_key" ON "NotionDatabase"("databaseId");

-- AddForeignKey
ALTER TABLE "NotionDatabase" ADD CONSTRAINT "NotionDatabase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
