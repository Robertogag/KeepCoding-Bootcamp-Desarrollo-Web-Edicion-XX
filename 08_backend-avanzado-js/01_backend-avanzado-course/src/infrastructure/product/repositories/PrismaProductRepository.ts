import { Product } from '../../../domain/product/Product';
import { ProductRepository } from '../../../domain/product/repositories/ProductRepository';
import { CreateProductUseCaseInput } from '../../../domain/product/use-cases/create-product';
import { FindProductsUseCaseInput } from '../../../domain/product/use-cases/find-products';
import { Pagination } from '../../../domain/shared/Pagination';
// Importamos la instancia compartida de PrismaClient en lugar de crear una nueva cada vez.
// Esto evita problemas de múltiples pools de conexión y condiciones de carrera.
import { prisma } from '../../prisma-client';

export class PrismaProductRepository implements ProductRepository {
  private readonly prisma = prisma;
  async findById(id: number): Promise<Product | null> {
    const product = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });

    return product;
  }

  async create(params: CreateProductUseCaseInput): Promise<Product> {
    const prismaProduct = await this.prisma.product.create({
      data: {
        name: params.name,
        description: params.description,
        price: params.price,
        userId: params.userId,
      },
    });

    return new Product({
      id: prismaProduct.id,
      createdAt: prismaProduct.createdAt,
      updatedAt: prismaProduct.updatedAt,
      name: prismaProduct.name,
      description: prismaProduct.description,
      price: prismaProduct.price,
      userId: prismaProduct.userId,
    });
  }

  async remove(id: number): Promise<void> {
    await this.prisma.product.delete({
      where: {
        id,
      },
    });
  }

  async isProductAvailable(id: number): Promise<boolean> {
    const count = await this.prisma.product.count({
      where: {
        id,
      },
    });

    // return Boolean(count);
    return count > 0 ? true : false;
  }

  async findMany(
    criteria: FindProductsUseCaseInput,
  ): Promise<{ products: Product[]; total: number }> {
    // const filters = {};

    // if (criteria.search) {
    //   filters.OR = [
    //     { name: { contains: criteria.search, mode: 'insensitive' } },
    //     { description: { contains: criteria.search, mode: 'insensitive' } },
    //   ];
    // }

    const where = criteria.search
      ? {
          OR: [
            { name: { contains: criteria.search, mode: 'insensitive' as const } },
            { description: { contains: criteria.search, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const { page, limit } = criteria;
    const productsDb = await this.prisma.product.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where,
    });

    const productsCount = await this.prisma.product.count({ where });

    // Si queremos hacer las 2 consultas en paralelo (más performance)
    // const [products, total] = await Promise.all([
    //   this.prisma.product.findMany({
    //     skip: (page - 1) * limit,
    //     take: limit,
    //   }),
    //   await this.prisma.product.count(),
    // ]);

    const products = productsDb.map(
      (productDb) =>
        new Product({
          id: productDb.id,
          name: productDb.name,
          price: productDb.price,
          userId: productDb.userId,
          description: productDb.description,
          createdAt: productDb.createdAt,
          updatedAt: productDb.updatedAt,
        }),
    );

    return {
      products,
      total: productsCount,
    };
  }
}
