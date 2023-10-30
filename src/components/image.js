export default function image(data) {
  let newData = data;
  [...newData.matchAll(/!image\((.*)\)/g)].forEach((match) => {
    const [src, alt, width, height, ...optionals] = [...match[1].split(",")];
    newData = newData.replace(
      match[0],
      `<div class="sd-img" style="${
        width && width.trim() !== "" ? `width: ${width}vw;` : "width: auto;"
      }${
        height && height.trim() !== ""
          ? `height: ${height}vh;`
          : "height: auto;"
      }${optionals || ""}">
        <img src="${src.trim()}" loading="lazy" alt="${alt}" />
      </div>`,
    );
  });
  return newData;
}