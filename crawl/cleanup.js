// Use the shared DB wrapper (mysql2 pool) used everywhere else
const { db } = require("./config/db");

// Test connection and basic query
const testConnection = async () => {
    try {
        const ok = await db.testConnection();
        if (!ok) {
            console.error("Error executing test query: database connection failed");
            return false;
        }
        const rows = await db.query('SELECT 1 AS test');
        console.log('Test query result:', rows); // Should print: [{ test: 1 }]
        return true;
    } catch (err) {
        console.error('Error executing test query:', err);
        return false;
    }
};

// Function to find locked script IDs from the database
const findLockedScriptIds = async () => {
    const query = `
        SELECT DISTINCT locked_by 
        FROM sites 
        WHERE site_locked = true 
        AND locked_by IS NOT NULL;
    `;
    try {
        const rows = await db.query(query);

        if (!rows || rows.length === 0) {
            console.log('No locked scripts found.');
            return [];
        }

        const scriptIds = rows
            .map(row => row.locked_by)
            .filter(id => !!id);

        console.log(`Found ${scriptIds.length} locked script IDs:`, scriptIds);
        return scriptIds;
    } catch (err) {
        console.error('Error finding locked script IDs:', err);
        return [];
    }
};

// Unlock all sites locked by the specified script ID
const unlockSitesByScriptId = async (scriptId) => {
    const unlockQuery = `
        UPDATE sites
        SET site_locked = false,
            locked_by = NULL
        WHERE locked_by = ?;
    `;
    try {
        const result = await db.query(unlockQuery, [scriptId]);
        const affectedRows = result && typeof result.affectedRows === 'number'
            ? result.affectedRows
            : 0;

        console.log(`Unlocked ${affectedRows} sites locked by script ID ${scriptId}`);
    } catch (err) {
        console.error(`Error unlocking sites for script ID ${scriptId}:`, err);
    }
};

// Unlock all sites by iterating over locked rows to avoid big locks
const unlockAllSites = async () => {
    try {
        // First get the list of locked sites (site_ids) without taking write locks
        const lockedSites = await db.query(
            `SELECT site_id, locked_by 
             FROM sites 
             WHERE site_locked = true AND locked_by IS NOT NULL`
        );

        if (!lockedSites || lockedSites.length === 0) {
            console.log('No locked sites to unlock.');
            return 0;
        }

        let totalUnlocked = 0;

        for (const row of lockedSites) {
            const { site_id, locked_by } = row;
            try {
                const result = await db.query(
                    `UPDATE sites
                     SET site_locked = false,
                         locked_by = NULL
                     WHERE site_id = ? AND site_locked = true AND locked_by IS NOT NULL`,
                    [site_id]
                );

                const affectedRows = result && typeof result.affectedRows === 'number'
                    ? result.affectedRows
                    : 0;

                if (affectedRows > 0) {
                    totalUnlocked += affectedRows;
                    console.log(`Unlocked site_id ${site_id} (locked_by=${locked_by}).`);
                }
            } catch (err) {
                if (err.code === 'ER_LOCK_WAIT_TIMEOUT') {
                    console.error(`Lock wait timeout unlocking site_id ${site_id}, skipping this row.`);
                    continue;
                }
                console.error(`Error unlocking site_id ${site_id}:`, err);
            }
        }

        console.log(`Unlocked ${totalUnlocked} sites by iterating locked site_ids.`);
        return totalUnlocked;
    } catch (err) {
        console.error('Error unlocking all sites:', err);
        return 0;
    }
};

// Main function to find and unlock sites
const unlockLockedSites = async () => {
    // First try to get all script IDs for informational purposes
    const scriptIds = await findLockedScriptIds();

    if (scriptIds.length > 0) {
        console.log('Found locked script IDs:', scriptIds);

        // We now only do a single bulk unlock to minimise locking and
        // avoid repeated UPDATEs that can hit lock-wait timeouts.
        console.log('Performing complete unlock of all sites in a single bulk operation:');
        const totalUnlocked = await unlockAllSites();
        console.log(`Successfully unlocked ${totalUnlocked} sites associated with ${scriptIds.length} script IDs.`);
    } else {
        console.log('No locked script IDs found.');
    }
};

// Execute the test query to check the connection
testConnection().then((ok) => {
    if (!ok) return;
    // After the test query, execute the unlocking process
    unlockLockedSites().catch(err => {
        console.error('Error in unlockLockedSites:', err);
    });
});
