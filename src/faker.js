import { faker } from '@faker-js/faker'
faker.locale = 'en'

export function createProduct() {
    return {
        name: faker.commerce.product(),
        stock: Math.floor(Math.random() * 10),
        thumbnail: faker.image.cats()
    }
}