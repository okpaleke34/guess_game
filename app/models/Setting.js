module.exports = (con, Sequelize) => {
    const { STRING,JSON } = Sequelize;
    const Setting = con.define(
        "settings",
        {
            name: {
                type: STRING,
            },
            value: {
                type: JSON,
            },
        },
        {
            freezeTableName: true,
            charset: 'latin1',
            collate: 'latin1_swedish_ci',
        }
    );

    return Setting;
};
