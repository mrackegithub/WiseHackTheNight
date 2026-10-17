-- CreateTable
CREATE TABLE "RemovedNeptunEvent" (
    "userId" UUID NOT NULL,
    "externalUid" TEXT NOT NULL,

    CONSTRAINT "RemovedNeptunEvent_pkey" PRIMARY KEY ("userId","externalUid")
);

-- AddForeignKey
ALTER TABLE "RemovedNeptunEvent" ADD CONSTRAINT "RemovedNeptunEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

