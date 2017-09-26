import { StaticRouter } from 'react-router-dom';
import { ApolloClient, createNetworkInterface, ApolloProvider, getDataFromTree } from 'react-apollo';

import React from 'react';
import express from 'express';
// import path from 'path';
import { renderToString } from 'react-dom/server';
// TODO: probably don't need both request and isomorphic-fetch
import request from 'request';
// eslint-disable-next-line no-unused-vars
import fetch from 'isomorphic-fetch'; // used by react-apollo
import { extractCritical } from 'emotion-server';
import App from './App';

const assets = require(process.env.RAZZLE_ASSETS_MANIFEST); // eslint-disable-line import/no-dynamic-require

const reactRender = (req, res) => {
    const client = new ApolloClient({
        ssrMode: true,
        networkInterface: createNetworkInterface({
            uri: 'https://v7qlnqrn3.lp.gql.zone/graphql'
        })
    });

    const context = {};

    const app = (
        <ApolloProvider client={client}>
            <StaticRouter location={req.url} context={context}>
                <App />
            </StaticRouter>
        </ApolloProvider>
    );

    if (context.url) {
        res.redirect(context.url);
    } else {
        getDataFromTree(app).then(() => {
            const content = renderToString(app);

            // NOTE: NOT sure what the difference is between client.store.getState() and client.getInitialState()
            const initialState = { apollo: client.getInitialState() };
            // const initialState = client.store.getState();

            const { ids, css } = extractCritical(content);

            res.status(200).send(
                `<!doctype html>
                    <html lang="">
                    <head>
                        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
                        <meta charSet='utf-8' />
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        ${assets.client.css ? `<link rel="stylesheet" href="${assets.client.css}">` : ''}
                        <script src="${assets.client.js}" defer></script>
                        <style>${css}</style>
                    </head>
                    <body>
                        <div id="root">${content}</div>
                        <script>
                            window.__APOLLO_STATE__ = ${JSON.stringify(initialState).replace(/</g, '\\u003c')}
                            window.__EMOTION_DATA__ = ${JSON.stringify(ids)}
                        </script>
                    </body>
                </html>`
            );
        });
    }
};

// These routes also need to be handled on the client side in App.js
const reactRoutes = ['/hello', '/foo'];

const server = express();
server
    .disable('x-powered-by')
    .use(express.static(process.env.RAZZLE_PUBLIC_DIR))
    .get(reactRoutes, reactRender)
    .get('/webpack/*', (req, res) => {
        const newUrl = `http://localhost:8082${req.url}`;
        request(newUrl).pipe(res);
    })
    .get('/*', (req, res) => {
        const newUrl = `http://localhost:8080${req.url}`;
        request(newUrl).pipe(res);
    });

export default server;
