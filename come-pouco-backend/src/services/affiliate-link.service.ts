import { pool } from '../config/db';
import HttpError from '../utils/httpError';

interface AffiliateLinkRow {
  id: number;
  original_link: string;
  product_image: string;
  catchy_phrase: string;
  affiliate_link: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AffiliateLinkOutput {
  id: number;
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
  createdAt: string;
  updatedAt: string;
}

interface CreateAffiliateLinkInput {
  originalLink: string;
  productImage: string;
  catchyPhrase: string;
  affiliateLink: string;
}

interface UpdateAffiliateLinkInput {
  originalLink?: string;
  productImage?: string;
  catchyPhrase?: string;
  affiliateLink?: string;
}

const toISOString = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
};

const toAffiliateLinkOutput = (row: AffiliateLinkRow): AffiliateLinkOutput => ({
  id: row.id,
  originalLink: row.original_link,
  productImage: row.product_image,
  catchyPhrase: row.catchy_phrase,
  affiliateLink: row.affiliate_link,
  createdAt: toISOString(row.created_at),
  updatedAt: toISOString(row.updated_at)
});

const listAffiliateLinks = async (): Promise<AffiliateLinkOutput[]> => {
  const query = `
    SELECT id, original_link, product_image, catchy_phrase, affiliate_link, created_at, updated_at
    FROM affiliate_links
    ORDER BY id DESC
  `;

  const result = await pool.query<AffiliateLinkRow>(query);
  return result.rows.map(toAffiliateLinkOutput);
};

const createAffiliateLink = async ({
  originalLink,
  productImage,
  catchyPhrase,
  affiliateLink
}: CreateAffiliateLinkInput): Promise<AffiliateLinkOutput> => {
  const query = `
    INSERT INTO affiliate_links (original_link, product_image, catchy_phrase, affiliate_link)
    VALUES ($1, $2, $3, $4)
    RETURNING id, original_link, product_image, catchy_phrase, affiliate_link, created_at, updated_at
  `;

  const values = [originalLink.trim(), productImage.trim(), catchyPhrase.trim(), affiliateLink.trim()];
  const result = await pool.query<AffiliateLinkRow>(query, values);

  return toAffiliateLinkOutput(result.rows[0]);
};

const updateAffiliateLink = async (
  id: number,
  { originalLink, productImage, catchyPhrase, affiliateLink }: UpdateAffiliateLinkInput
): Promise<AffiliateLinkOutput> => {
  const updates: string[] = [];
  const values: string[] = [];

  if (originalLink !== undefined) {
    updates.push(`original_link = $${updates.length + 1}`);
    values.push(originalLink.trim());
  }

  if (productImage !== undefined) {
    updates.push(`product_image = $${updates.length + 1}`);
    values.push(productImage.trim());
  }

  if (catchyPhrase !== undefined) {
    updates.push(`catchy_phrase = $${updates.length + 1}`);
    values.push(catchyPhrase.trim());
  }

  if (affiliateLink !== undefined) {
    updates.push(`affiliate_link = $${updates.length + 1}`);
    values.push(affiliateLink.trim());
  }

  if (!updates.length) {
    throw new HttpError(400, 'Informe ao menos um campo para atualização.');
  }

  values.push(String(id));

  const query = `
    UPDATE affiliate_links
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${values.length}
    RETURNING id, original_link, product_image, catchy_phrase, affiliate_link, created_at, updated_at
  `;

  const result = await pool.query<AffiliateLinkRow>(query, values);

  if (!result.rows[0]) {
    throw new HttpError(404, 'Link de afiliado não encontrado.');
  }

  return toAffiliateLinkOutput(result.rows[0]);
};

const deleteAffiliateLink = async (id: number): Promise<void> => {
  const result = await pool.query('DELETE FROM affiliate_links WHERE id = $1', [id]);

  if (!result.rowCount) {
    throw new HttpError(404, 'Link de afiliado não encontrado.');
  }
};

export { createAffiliateLink, deleteAffiliateLink, listAffiliateLinks, updateAffiliateLink };
