/**
 * Products router - mounted at /strategies/:strategyId/products
 * So GET/POST /strategies/:strategyId/products and PATCH/DELETE /strategies/:strategyId/products/:productId
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import pool from "../db/pool";

const router = Router({ mergeParams: true });

const valuePointSchema = z.object({
  listen_for: z.string(),
  insight_text: z.string(),
  link: z.string().optional(),
});

const createProductSchema = z.object({
  title: z.string().min(1, "Product title is required"),
  description: z.string().optional(),
  value_points: z.array(valuePointSchema).optional().default([]),
});

const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  value_points: z.array(valuePointSchema).optional(),
});

// GET / - List products for the strategy (strategyId from req.params)
router.get("/", async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.strategyId;
    if (!strategyId) {
      res.status(400).json({ error: "Strategy ID is required" });
      return;
    }

    const strategyCheck = await pool.query(
      "SELECT id FROM public.strategies WHERE id = $1",
      [strategyId]
    );
    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    const productsResult = await pool.query(
      `SELECT id, strategy_id, title, description, created_at
       FROM public.products
       WHERE strategy_id = $1
       ORDER BY created_at ASC`,
      [strategyId]
    );

    const products = productsResult.rows;
    const productsWithPoints = await Promise.all(
      products.map(async (p: { id: string }) => {
        const vpResult = await pool.query(
          `SELECT id, product_id, listen_for, insight_text, link, sort_order, created_at
           FROM public.product_value_points
           WHERE product_id = $1
           ORDER BY sort_order ASC, created_at ASC`,
          [p.id]
        );
        return { ...p, value_points: vpResult.rows };
      })
    );

    res.json(productsWithPoints);
  } catch (error) {
    console.error("Error fetching products for strategy:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// POST / - Create product (strategyId from req.params)
router.post("/", async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.strategyId;
    if (!strategyId) {
      res.status(400).json({ error: "Strategy ID is required" });
      return;
    }

    const parsed = createProductSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const strategyCheck = await pool.query(
      "SELECT id FROM public.strategies WHERE id = $1",
      [strategyId]
    );
    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    const { title, description, value_points } = parsed.data;

    const validValuePoints = (value_points ?? []).filter(
      (vp: { listen_for: string; insight_text: string; link?: string }) =>
        vp.listen_for?.trim().length > 0 && vp.insight_text?.trim().length > 0
    );

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const productResult = await client.query(
        `INSERT INTO public.products (strategy_id, title, description, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [strategyId, title, description || null]
      );
      const product = productResult.rows[0];

      for (let i = 0; i < validValuePoints.length; i++) {
        const vp = validValuePoints[i];
        await client.query(
          `INSERT INTO public.product_value_points (product_id, listen_for, insight_text, link, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [product.id, vp.listen_for, vp.insight_text, vp.link || null, i]
        );
      }

      await client.query("COMMIT");

      const vpResult = await client.query(
        `SELECT id, product_id, listen_for, insight_text, link, sort_order, created_at
         FROM public.product_value_points
         WHERE product_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [product.id]
      );
      res.status(201).json({ ...product, value_points: vpResult.rows });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// PATCH /:productId - Update product
router.patch("/:productId", async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.strategyId;
    const productId = req.params.productId;
    if (!strategyId || !productId) {
      res.status(400).json({ error: "Strategy ID and Product ID are required" });
      return;
    }

    const parsed = updateProductSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.errors,
      });
      return;
    }

    const productCheck = await pool.query(
      "SELECT id, strategy_id, title, description FROM public.products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    const product = productCheck.rows[0];
    if (product.strategy_id !== strategyId) {
      res.status(404).json({ error: "Product not found in this strategy" });
      return;
    }

    const { title, description, value_points } = parsed.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (title !== undefined) {
        await client.query(
          "UPDATE public.products SET title = $1 WHERE id = $2",
          [title, productId]
        );
      }
      if (description !== undefined) {
        await client.query(
          "UPDATE public.products SET description = $1 WHERE id = $2",
          [description, productId]
        );
      }

      if (value_points !== undefined) {
        const validValuePoints = value_points.filter(
          (vp: { listen_for: string; insight_text: string; link?: string }) =>
            vp.listen_for?.trim().length > 0 && vp.insight_text?.trim().length > 0
        );
        await client.query("DELETE FROM public.product_value_points WHERE product_id = $1", [productId]);
        for (let i = 0; i < validValuePoints.length; i++) {
          const vp = validValuePoints[i];
          await client.query(
            `INSERT INTO public.product_value_points (product_id, listen_for, insight_text, link, sort_order, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [productId, vp.listen_for, vp.insight_text, vp.link || null, i]
          );
        }
      }

      await client.query("COMMIT");

      const updated = await client.query(
        "SELECT * FROM public.products WHERE id = $1",
        [productId]
      );
      const vpResult = await client.query(
        `SELECT id, product_id, listen_for, insight_text, link, sort_order, created_at
         FROM public.product_value_points
         WHERE product_id = $1
         ORDER BY sort_order ASC, created_at ASC`,
        [productId]
      );
      res.json({ ...updated.rows[0], value_points: vpResult.rows });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// DELETE /:productId - Delete product
router.delete("/:productId", async (req: Request, res: Response) => {
  try {
    const strategyId = req.params.strategyId;
    const productId = req.params.productId;
    if (!strategyId || !productId) {
      res.status(400).json({ error: "Strategy ID and Product ID are required" });
      return;
    }

    const productCheck = await pool.query(
      "SELECT id, strategy_id FROM public.products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }
    if (productCheck.rows[0].strategy_id !== strategyId) {
      res.status(404).json({ error: "Product not found in this strategy" });
      return;
    }

    await pool.query("DELETE FROM public.products WHERE id = $1", [productId]);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
