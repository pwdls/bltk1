module.exports = (data, socket, connection) => {
    data = JSON.parse(data);
    let van = '"' + data.wagons.toString().replace(/,/g, '","') + '"';
    let railwaysSource = [];
    let currentState = {};

    // console.log(data);

    function queryMysql(query, connection) {

        // console.log(query);

        return new Promise((resolve, reject) => {
            connection.query(query, (error, results) => {
                if (error) {
                    console.log(query);
                    reject(error);
                }
                        // console.log(results);
                let foo = false;
                if(Array.isArray(results)){
                    foo = results;
                }
                resolve(JSON.parse(JSON.stringify(foo)));
            });
        });
    }

    const getRailwaysSource = () => {
        return new Promise(resolve => {

            let query = `SELECT railway
                         FROM state_path
                         WHERE van in (${van})
                         GROUP BY railway;`;

            queryMysql(query, connection)
                .then(result => resolve(result))
        });
    }

    const getAllWagonsOnTheRailvaysSource = (obj) => {
        return new Promise(resolve => {
            let query = `SELECT sp.railway                           railway,
                                GROUP_CONCAT(van ORDER BY sp.number) van
                         FROM state_path sp
                         WHERE railway = "${obj.railway}"
                         GROUP BY sp.railway;`;

            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    const removeWagonsFromCurrentRailwais = () => {
        return new Promise(resolve => {
            let query = `DELETE
                         FROM state_path sp
                         WHERE van in (${van});`;

            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }


    function updateLocationOfWagonsOnTheRailwaySource(obj) {
        //  console.log(obj);
        obj.van.split(',').map((val, key) => {
            let query = `UPDATE state_path
                         SET number=${key + 1}
                         WHERE van = "${val}";`;
            queryMysql(query, connection);
        });
    }

    function getRailwayInput() {
        return new Promise(resolve => {
            let query = `SELECT sp.railway                                       railway,
                                GROUP_CONCAT(van ORDER BY sp.railway, sp.number) van
                         FROM state_path sp
                         WHERE railway = "${data.railway}"
                         GROUP BY sp.railway;`;

            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function getListUpdateRailwayInput(obj) {
        // console.log(index);

        if (data.to !== "") {
            let index = obj.van.indexOf(data.to.toString()) + data.to.toString().length;
            let s1 = obj.van.slice(0, index);
            let s2 = obj.van.slice(index);
            obj.van = s1 + ',' + data.wagons.toString() + s2;
        } else {
            obj.van = data.wagons.toString() + ',' + obj.van

            // console.log(obj);
        }


        // console.log(obj);

        return obj;
    }

    function updateRailwayInput(obj) {
        obj.van.split(',').map((val, key) => {

            // console.log(data.wagons);
            // console.log(data.wagons.indexOf(val));
            // console.log(val);

            let query = "";
            if (data.wagons.indexOf(val) === -1) {
                query = `UPDATE state_path
                         SET number=${key + 1}
                         WHERE van = "${val}";`;
            } else {
                query = `INSERT INTO state_path
                             (van, railway, number)
                         VALUES ("${val}", "${obj.railway}", ${key + 1});`;
            }

            // console.log(query);

            queryMysql(query, connection);
        });
    }

    //исправить

    function getPark(connection) {
        return new Promise(resolve => {
            let query = "SELECT GUID, shortName name, 0 active  FROM list_park ORDER BY name;";
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function getRailways(GUID, connection) {
        return new Promise(resolve => {
            let query = `SELECT GUID, name, 0 active
                         FROM list_railway
                         WHERE parkGUID = "${GUID}"
                         ORDER BY name;`;
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function addRailways(arr, connection) {
        return new Promise((resolve) => {
            getRailways(arr.GUID, connection)
                .then(result => {
                    let res = arr;
                    res["railways"] = result;
                    resolve(res);
                });
        });
    }

    function getCurrentStateWagons() {
        return new Promise(resolve => {
            let query = `SELECT lv.number   number,
                                lv.loaded   loaded,
                                lmv.footage footage,
                                lv.status   status,
                                lv.train    train,
                                lv.owner    owner,
                                lo.name      ownerName,
                                lo.fullName  ownerFullName
                         FROM list_van lv
                                  LEFT JOIN list_model_van lmv ON lv.model = lmv.GUID
                                  LEFT JOIN list_owner lo on lv.owner = lo.GUID
                         WHERE lv.deletionMark = 0;`;
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function getCurrentStateRailways() {
        return new Promise(resolve => {
            let query = `SELECT lr.GUID                 GUID,
                                lr.name                 name,
                                lr.length               allLength,
                                lr.countVan             countWagonsMax,
                                ROUND(s1.busyLength, 1) busyLength,
                                s1.countWagons          countWagons,
                                s1.wagons               wagons
                         FROM list_railway lr
                                  LEFT JOIN (
                             SELECT COUNT(sp.number)                        countWagons,
                                    sp.railway                              GUID,
                                    GROUP_CONCAT(sp.van ORDER BY sp.number) wagons,
                                    SUM(lmv.lengthAxis)                     busyLength
                             FROM state_path sp
                                      LEFT JOIN list_van lv on sp.van = lv.number
                                      LEFT JOIN list_model_van lmv on lv.model = lmv.GUID
                             WHERE lv.deletionMark = 0
                             GROUP BY sp.railway) s1
                                            ON s1.GUID = lr.GUID
                         WHERE deletionMark = 0;`;
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function convertArray(array, id) {
        return array.reduce((previousValue, currentValue, index) => {
            let result = {};
            if (index === 1) {
                result[previousValue[id]] = previousValue;
            } else {
                result = previousValue;
            }
            result[currentValue[id]] = currentValue;
            return result;
        });
    }


    function checkThatItIsNotAnEmptyArray(result) {
        if(result.length == 0){
            result.push(
                {
                    railway: data.railway,
                    van: ''
                }
            );
        }
        return result
    }

    function getOwners() {
        return new Promise(resolve => {
            let query = `SELECT GUID     GUID,
                                name     name,
                                fullName fullName
                         FROM list_owner
                         WHERE deletionMark = 0
                         ORDER BY name;`;
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }

    function getTrains() {
        return new Promise(resolve => {
            let query = `SELECT lt.GUID  GUID,
                                lt.name  name,
                                lt.owner owner,
                                lt.station station,
                                lt.countVan countWagons
                         FROM list_train lt
                         WHERE deletionMark = 0
                         ORDER BY name;`;
            queryMysql(query, connection)
                .then(result => resolve(result));
        });
    }



    if (data.wagons && data.wagons.length > 0) {
        getRailwaysSource()
            .then(railways => railwaysSource = railways)
            .then(() => removeWagonsFromCurrentRailwais())
            .then(() => railwaysSource.map((railway) => getAllWagonsOnTheRailvaysSource(railway)))
            .then(wagons => Promise.all(wagons))
            // .then(result => console.log(result))
            .then(wagons => wagons.flat(1).map(wagon => updateLocationOfWagonsOnTheRailwaySource(wagon)))
            .then(() => getRailwayInput())
            .then(result => checkThatItIsNotAnEmptyArray(result))
            .then(result => result.map(obj => getListUpdateRailwayInput(obj)))
            .then(result => result.map(obj => updateRailwayInput(obj)))
            //все вынести отедльно
            .then(() => getPark(connection))
            .then(result => result.map((arr) => addRailways(arr, connection)))
            .then(result => Promise.all(result))
            .then(result => currentState.menu = result)
            .then(() => getCurrentStateRailways())
            .then(result => result.map((arr) => {
                if (arr.busyLength !== null) {
                    let busy = Math.round((1 - arr.busyLength / arr.allLength) * 100);
                    if (busy >= 75) {
                        arr.busy = 0;
                    } else if (busy >= 25) {
                        arr.busy = 1;
                    } else {
                        arr.busy = 2;
                    }
                } else {
                    arr.busy = 0;
                }
                arr.wagons = (arr.wagons !== null && arr.wagons !== undefined) ? arr.wagons.split(",") : [];
                return arr;
            }))
            .then(result => convertArray(result, "name"))
            .then(result => currentState.railways = result)
            .then(() => getCurrentStateWagons())
            .then(result => convertArray(result, "number"))
            .then(result => currentState.wagons = result)
            .then(() => getOwners())
            .then(result => currentState.owners = result)
            .then(() => getTrains())
            .then(result => currentState.trains = result)
            //  .then(() => console.log(JSON.stringify(currentState)))
            .then(() => socket.emit("currentState", JSON.stringify(currentState)))

            .catch(e => console.log(e))
        //;
    }
}



