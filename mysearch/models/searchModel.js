//searchModel.js

const { con } = require("../mysql");
var md5 = require('md5');
const { Client } = require("@elastic/elasticsearch");
const client = new Client({
    node: 'http://localhost:9200'
});

const get = async(x = null) => { return x; }
const set = async(x = null) => {
    if (x.site_id === undefined) {
        await con.query(`UPDATE site SET site_name = '${x.site_name}', site_url = '${x.site_url}' WHERE  site.site_id = ${req.body.site_id};`);
    } else {
        await con.query(`INSERT INTO site (site_name, site_url) VALUES ('${x.site_name}', '${x.site_url}');`);
    }
}
const login = async(x = null) => await con.query(`SELECT * FROM users WHERE user_username LIKE '${x.username}' and user_password LIKE '${md5(x.password)}';`);
module.exports = {
    get,
    set,
    login
}