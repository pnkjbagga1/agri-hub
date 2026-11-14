-- CreateTable
CREATE TABLE "BuyBcProduct" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "BuyBcProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyBcProduct_profileId_idx" ON "BuyBcProduct"("profileId");

-- CreateIndex
CREATE INDEX "BuyBcProduct_category_idx" ON "BuyBcProduct"("category");

-- AddForeignKey
ALTER TABLE "BuyBcProduct" ADD CONSTRAINT "BuyBcProduct_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
