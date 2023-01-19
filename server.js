//------------------//
//      Imports     //
//------------------//

import { Mongo } from './src/db/mongo.js';
import { ProductsOptions } from './src/db/connection/connection.js';
import ProductsClienteSQL from './src/db/classes/ProductsClass.js';
import { createProduct } from './src/faker.js';
import { normalize, denormalize, schema } from 'normalizr';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import express  from 'express'
import { createServer } from 'http'
import { Server }  from 'socket.io'
const app = express()
import { engine as exphbs } from 'express-handlebars'
app.engine('.hbs', exphbs({ extname: '.hbs', defaultLayout: 'main.hbs' }))
app.set('view engine', '.hbs')


//------------------//
//      Dirname     //
//------------------//

import path from 'path';
import {fileURLToPath} from 'url';

// 👇️ "/home/borislav/Desktop/javascript/index.js"
const __filename = fileURLToPath(import.meta.url);

// 👇️ "/home/borislav/Desktop/javascript"
const __dirname = path.dirname(__filename);


//----------------------//
//      Middlewares     //
//----------------------//

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('./src'))
app.use(cookieParser())
app.use(session({
    secret: 'sh',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 60000
    }
}))
app.use((req, res, next) => {
    req.isAuthenticated = () => {
        if (req.session.nombre) {
            return true
        }
        return false
    }

    req.logout = callback => {
        req.session.destroy(callback)
    }

    next()
})

//--------------------//
//      Variables     //
//--------------------//

const httpServer = createServer(app);
const io = new Server(httpServer, {});
const products = []
const sessions = []

//-------------//
//      IO     //
//-------------//

io.on('connection', socket => {
    console.log('New user connected');

        socket.emit('products', products);
        socket.on('update-products', data => {
            products.push(data);

            const sqlProducts = new ProductsClienteSQL(ProductsOptions);

            sqlProducts.crearTabla()
            .then(() => {
                return sqlProducts.addProducts(products)
            })
            .catch((err) => {
                console.log(err);
            })
            .finally(() => {
                return sqlProducts.close()
            })

            io.sockets.emit('products', products);
        })

        new Mongo().getMsg()
        .then(d => {
            socket.emit('messages', d)
            socket.on('update-chat',async data => {
            
                await new Mongo().addMsgMongo(data)

                new Mongo().getMsg()
                .then(data2 => {

                    // NORMALIZACION DE LOS DATOS

                    data2 = {
                        id:1,
                        messages: data2
                    }

                    const authorSchema = new schema.Entity(
                        'author',
                        {},
                        { idAttribute: data2.messages.forEach(e => e.author.id) }
                    );
            
                    const messageSchema = new schema.Entity('message', {
                        author: authorSchema
                    })
            
                    const postSchema = new schema.Entity('post', {
                        mensajes: [messageSchema]
                    })
            
                    const mensajesNormalizados = normalize(data2, postSchema);

                    // DESNORMALIZACION PARA QUE SEA POSIBLE GRAFICAR LOS DATOS

                    const objDenormalizado = denormalize(mensajesNormalizados.result, postSchema, mensajesNormalizados.entities)

                    io.sockets.emit('messages', objDenormalizado.messages)
                })
                .catch(err => {
                    console.log(err);
                })
            })
        })
        .catch(err => {
            console.log(err);
        })
})

//--------------//
//      APP     //
//--------------//

app.get('/', (req, res, next) => {
    if (req.session.nombre) {
        console.log(req.session.nombre);
        return res.redirect('/datos')
    } 

    res.sendFile(__dirname + '/src/login.html')
})

app.get('/api/productos-test', (req, res) => {
    for (let i = 0; i < 5; i++) {
        products.push(createProduct())
    }

    res.json({estado: "productos agregados correctamente"})
})

app.post('/login', (req, res) => {
    const { user } = req.body;

    const validacion = sessions.find(u => u == user);

    if (!validacion) {
        res.json({error: 'este user no existe, registrese en la ruta /register'})
    }

    req.session.nombre = user
    res.redirect('/datos')
})

app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/src/register.html')
})

app.post('/register', (req, res) => {
    const { user } = req.body;

    sessions.push(user)

    res.redirect('/')
})

app.get('/datos', requireAuthentication, (req, res) => {
    res.sendFile(__dirname + '/src/main.html')
})

app.get('/get-name', async (req, res) => {

    res.send({ nombre: req.session.nombre })
})

app.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/')
})

//--------------------//
//      functions     //
//--------------------//

function requireAuthentication(req, res, next) {
    if (req.isAuthenticated()) {
        next()
    } else {
        res.redirect('/')
    }
}

//--------------------//
//      Listening     //
//--------------------//

const PORT = 8080

httpServer.listen(PORT, () => {
    console.log(`Escuchando en el ${PORT}`);
})