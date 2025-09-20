const { con } = require("../mysql");
const get = async(x = null) => {
    return await con.query("SELECT * FROM `site` WHERE 1 LIMIT 0,100");
}
const set = async(x = null) => {
    if (x.site_id != undefined) await con.query(`UPDATE site SET site_name = '${x.site_name}', site_url = '${x.site_url}' WHERE  site.site_id = ${x.site_id};`);
    else await con.query(`INSERT INTO site (site_name, site_url) VALUES ('${x.site_name}', '${x.site_url}');`);
}
module.exports = {get, set };