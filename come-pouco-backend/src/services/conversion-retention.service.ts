import prisma from '../config/prisma';

interface AnonymizeConversionsResult {
  olderThan: string;
  anonymizedCount: number;
}

const anonymizeConversionsOlderThan = async (
  olderThan: Date
): Promise<AnonymizeConversionsResult> => {
  const result = await prisma.conversion.updateMany({
    where: {
      createdAt: {
        lt: olderThan
      },
      OR: [
        {
          ipHash: {
            not: ''
          }
        },
        {
          userAgent: {
            not: ''
          }
        },
        {
          referrer: {
            not: null
          }
        }
      ]
    },
    data: {
      ipHash: '',
      userAgent: '',
      referrer: null
    }
  });

  return {
    olderThan: olderThan.toISOString(),
    anonymizedCount: result.count
  };
};

export { anonymizeConversionsOlderThan };
export type { AnonymizeConversionsResult };
