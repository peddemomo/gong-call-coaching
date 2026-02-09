/**
 * Strategy-Product association router - mounted at /strategies/:strategyId/products
 * Manages which products are associated with a strategy via the strategy_products junction table.
 *
 * GET  /                  - list products associated with this strategy
 * POST /:productId        - associate an existing product with this strategy
 * DELETE /:productId      - disassociate a product from this strategy (does NOT delete the product)
 */
import { Router, Request, Response } from "express";
import pool from "../db/pool";

const router = Router({ mergeParams: true });

// GET / - List products associated with this strategy (with value points)
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
      `SELECT p.id, p.title, p.description, p.created_at
       FROM public.products p
       JOIN public.strategy_products sp ON sp.product_id = p.id
       WHERE sp.strategy_id = $1
       ORDER BY sp.created_at ASC`,
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

// POST /:productId - Associate an existing product with this strategy
router.post("/:productId", async (req: Request, res: Response) => {
  try {
    const { strategyId, productId } = req.params;
    if (!strategyId || !productId) {
      res.status(400).json({ error: "Strategy ID and Product ID are required" });
      return;
    }

    // Verify strategy exists
    const strategyCheck = await pool.query(
      "SELECT id FROM public.strategies WHERE id = $1",
      [strategyId]
    );
    if (strategyCheck.rows.length === 0) {
      res.status(404).json({ error: "Strategy not found" });
      return;
    }

    // Verify product exists
    const productCheck = await pool.query(
      "SELECT id FROM public.products WHERE id = $1",
      [productId]
    );
    if (productCheck.rows.length === 0) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    // Check if already associated
    const existingCheck = await pool.query(
      "SELECT id FROM public.strategy_products WHERE strategy_id = $1 AND product_id = $2",
      [strategyId, productId]
    );
    if (existingCheck.rows.length > 0) {
      res.status(409).json({ error: "Product is already associated with this strategy" });
      return;
    }

    await pool.query(
      `INSERT INTO public.strategy_products (strategy_id, product_id, created_at)
       VALUES ($1, $2, NOW())`,
      [strategyId, productId]
    );

    res.status(201).json({ message: "Product associated with strategy" });
  } catch (error) {
    console.error("Error associating product with strategy:", error);
    res.status(500).json({ error: "Failed to associate product" });
  }
});

// DELETE /:productId - Disassociate a product from this strategy
router.delete("/:productId", async (req: Request, res: Response) => {
  try {
    const { strategyId, productId } = req.params;
    if (!strategyId || !productId) {
      res.status(400).json({ error: "Strategy ID and Product ID are required" });
      return;
    }

    const result = await pool.query(
      "DELETE FROM public.strategy_products WHERE strategy_id = $1 AND product_id = $2",
      [strategyId, productId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Association not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error disassociating product from strategy:", error);
    res.status(500).json({ error: "Failed to disassociate product" });
  }
});

export default router;
